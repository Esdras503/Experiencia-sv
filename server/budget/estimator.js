import {
  BUDGET_CATEGORY_LABELS,
  BUDGET_CURRENCY,
  BUDGET_MEAL_TIERS,
  BUDGET_TRANSPORT_MODES,
  DEFAULT_BUDGET_SETTINGS,
  mergeBudgetSettings,
} from '../../shared/budget.js'
import { haversineMeters, isValidLatitude, isValidLongitude } from '../../shared/geo.js'

const DEFAULT_ROAD_FACTOR = DEFAULT_BUDGET_SETTINGS.roadFactor
const DEFAULT_AVERAGE_SPEED_KMH = DEFAULT_BUDGET_SETTINGS.averageSpeedKmh

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function nonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.round(parsed))
}

function roundCents(value) {
  return Math.max(0, Math.round(finiteNumber(value)))
}

function centsRange(amountCents, rangePercent) {
  const amount = roundCents(amountCents)
  const percent = Math.min(50, Math.max(0, finiteNumber(rangePercent)))
  if (amount === 0 || percent === 0) return [amount, amount]
  return [
    Math.max(0, Math.round(amount * (1 - percent / 100))),
    Math.max(0, Math.round(amount * (1 + percent / 100))),
  ]
}

function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .trim()
}

function validLocation(location) {
  return (
    location &&
    typeof location === 'object' &&
    isValidLatitude(Number(location.latitude)) &&
    isValidLongitude(Number(location.longitude))
  )
}

function locationOf(value) {
  return {
    latitude: Number(value.latitude),
    longitude: Number(value.longitude),
  }
}

/**
 * Construye la secuencia de puntos del recorrido. Si hay origen, se incluye
 * también al final para representar el regreso. No inventa coordenadas: las
 * paradas sin ubicación válida se omiten y se informa en `skippedStops`.
 */
export function buildRoutePoints(itinerary) {
  const stops = Array.isArray(itinerary?.stops) ? itinerary.stops : []
  const origin = validLocation(itinerary?.origin) ? itinerary.origin : null
  const skippedStops = []
  const validStops = []

  for (const stop of stops) {
    const location = stop?.place?.location
    if (!validLocation(location)) {
      skippedStops.push(stop?.place?.name ?? 'Parada sin nombre')
      continue
    }
    validStops.push({
      label: stop?.place?.name ?? 'Parada',
      ...locationOf(location),
    })
  }

  const points = []
  if (origin) {
    points.push({
      label: typeof origin.label === 'string' ? origin.label : 'Punto de salida',
      ...locationOf(origin),
    })
  }
  points.push(...validStops)
  if (origin && validStops.length > 0) {
    points.push({
      label: typeof origin.label === 'string' ? origin.label : 'Punto de salida',
      ...locationOf(origin),
    })
  }

  return {
    points,
    returnToOrigin: Boolean(origin && validStops.length > 0),
    skippedStops,
  }
}

/**
 * Respaldo determinista cuando OSRM no responde. Aplica un factor de carretera
 * configurable a la distancia en línea recta y estima el tiempo con una
 * velocidad media. La respuesta queda marcada como estimada.
 */
export function buildEstimatedRoute(routePoints, settings = {}) {
  const points = Array.isArray(routePoints?.points) ? routePoints.points : []
  const roadFactor = Math.max(1, finiteNumber(settings.roadFactor, DEFAULT_ROAD_FACTOR))
  const averageSpeed = Math.max(
    1,
    finiteNumber(settings.averageSpeedKmh, DEFAULT_AVERAGE_SPEED_KMH),
  )
  const legs = []
  let distanceMeters = 0
  let durationSeconds = 0

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    const straightDistance = haversineMeters(from, to)
    const legDistance = Math.max(0, Math.round(straightDistance * roadFactor))
    const legDuration = Math.max(
      0,
      Math.round((legDistance / 1000 / averageSpeed) * 3600),
    )
    distanceMeters += legDistance
    durationSeconds += legDuration
    legs.push({
      fromLabel: from.label,
      toLabel: to.label,
      distanceMeters: legDistance,
      durationSeconds: legDuration,
    })
  }

  return {
    source: points.length >= 2 ? 'haversine-estimate' : 'none',
    estimated: true,
    distanceMeters,
    durationSeconds,
    legs,
    returnToOrigin: routePoints?.returnToOrigin === true,
    skippedStops: Array.isArray(routePoints?.skippedStops) ? routePoints.skippedStops : [],
  }
}

function normalizeEntrancePrices(rows) {
  if (!Array.isArray(rows)) return []

  return rows
    .map((row) => {
      if (!row || typeof row !== 'object' || row.isActive === false) return null
      const adultCents = row.adultCents ?? row.adult_cents
      const childCents = row.childCents ?? row.child_cents
      const groupCents = row.groupCents ?? row.group_cents
      const activityCents = row.activityCents ?? row.activity_cents
      const hasPrice = [adultCents, childCents, groupCents, activityCents].some(
        (value) => value !== null && value !== undefined,
      )
      const declaredStatus = row.verificationStatus ?? row.verification_status
      const verifiedAt = row.verifiedAt ?? row.verified_at ?? null
      const verificationStatus =
        declaredStatus === 'verified' && verifiedAt
          ? 'verified'
          : hasPrice
            ? 'estimated'
            : 'unverified'

      return {
        id: row.id ?? null,
        placeId: row.placeId ?? row.place_id ?? null,
        name: typeof row.name === 'string' ? row.name : '',
        category: row.category ?? null,
        adultCents: adultCents === null || adultCents === undefined ? null : nonNegativeInteger(adultCents),
        childCents: childCents === null || childCents === undefined ? null : nonNegativeInteger(childCents),
        groupCents: groupCents === null || groupCents === undefined ? null : nonNegativeInteger(groupCents),
        groupMinPeople:
          row.groupMinPeople ?? row.group_min_people ?? null,
        activityCents:
          activityCents === null || activityCents === undefined
            ? null
            : nonNegativeInteger(activityCents),
        currency: row.currency ?? BUDGET_CURRENCY,
        source: typeof row.source === 'string' ? row.source : null,
        verifiedAt,
        verificationStatus,
        notes: typeof row.notes === 'string' ? row.notes : null,
      }
    })
    .filter(Boolean)
}

function entrancePriceIndex(rows) {
  const byPlace = new Map()
  const byName = new Map()

  for (const row of normalizeEntrancePrices(rows)) {
    if (row.placeId && !byPlace.has(row.placeId)) byPlace.set(row.placeId, row)
    const key = normalizeKey(row.name)
    if (key && !byName.has(key)) byName.set(key, row)
  }

  return { byPlace, byName }
}

function priceForStop(index, stop) {
  const placeId = stop?.place?.id
  if (placeId && index.byPlace.has(placeId)) return index.byPlace.get(placeId)
  const key = normalizeKey(stop?.place?.name)
  return key ? (index.byName.get(key) ?? null) : null
}

function groupApplies(price, travelers) {
  return (
    price?.groupCents !== null &&
    price?.groupCents !== undefined &&
    travelers >= Math.max(1, nonNegativeInteger(price.groupMinPeople, 1))
  )
}

function entranceAmount(price, adults, children, travelers, rangePercent) {
  if (groupApplies(price, travelers)) {
    const [minCents, maxCents] =
      price.verificationStatus === 'verified'
        ? [price.groupCents, price.groupCents]
        : centsRange(price.groupCents, rangePercent)
    return {
      minCents,
      maxCents,
      basis: 'group',
      note: `Tarifa por grupo (mínimo ${Math.max(1, nonNegativeInteger(price.groupMinPeople, 1))} personas).`,
    }
  }

  const adultPrice = price.adultCents ?? price.childCents
  const childPrice = price.childCents ?? price.adultCents
  if (adultPrice === null && childPrice === null) return null

  const amount =
    nonNegativeInteger(adultPrice) * adults + nonNegativeInteger(childPrice) * children
  const [minCents, maxCents] =
    price.verificationStatus === 'verified'
      ? [amount, amount]
      : centsRange(amount, rangePercent)

  return {
    minCents,
    maxCents,
    basis: 'person',
    note:
      price.childCents === null && children > 0
        ? 'No hay tarifa infantil registrada; se usó la tarifa adulta para los niños.'
        : null,
  }
}

/**
 * Calcula un presupuesto determinista a partir de datos ya validados. No llama
 * a ninguna IA ni inventa precios: las tarifas vienen de la configuración
 * administrativa y las entradas de un catálogo editable.
 */
export function estimateBudget({
  itinerary,
  options = {},
  settings = DEFAULT_BUDGET_SETTINGS,
  entrancePrices = [],
  route = null,
  routePoints = null,
  now = Date.now,
  pricingSource = 'defaults',
} = {}) {
  const mergedSettings = mergeBudgetSettings(settings)
  const travelers = Math.max(1, Math.min(50, nonNegativeInteger(options.travelers ?? itinerary?.travelers, 1)))
  const children = Math.max(0, Math.min(travelers, nonNegativeInteger(options.children, 0)))
  const adults = travelers - children
  const days = Math.max(1, Math.min(60, nonNegativeInteger(options.days ?? itinerary?.durationDays, 1)))
  const transportMode = BUDGET_TRANSPORT_MODES.includes(options.transportMode)
    ? options.transportMode
    : 'particular'
  const mealTier = BUDGET_MEAL_TIERS.includes(options.mealTier)
    ? options.mealTier
    : 'estandar'
  const lodgingTier =
    typeof options.lodgingTier === 'string' && options.lodgingTier in mergedSettings.lodgingPerPersonNightCents
      ? options.lodgingTier
      : 'estandar'
  const includeLodging =
    options.includeLodging === undefined || options.includeLodging === null
      ? days > 1
      : options.includeLodging === true
  const nights = includeLodging
    ? Math.max(0, Math.min(60, nonNegativeInteger(options.nights, days > 1 ? days - 1 : 1)))
    : 0
  const rangePercent = Math.min(
    50,
    Math.max(0, finiteNumber(mergedSettings.estimateRangePercent, 10)),
  )
  const pointsData = routePoints ?? buildRoutePoints(itinerary)
  const resolvedRoute = route ?? buildEstimatedRoute(pointsData, mergedSettings)
  const distanceMeters = Math.max(0, roundCents(resolvedRoute?.distanceMeters))
  const durationSeconds = Math.max(0, roundCents(resolvedRoute?.durationSeconds))
  const legs = Array.isArray(resolvedRoute?.legs) ? resolvedRoute.legs : []
  const warnings = []
  const assumptions = [
    'Los importes usan tarifas configurables de referencia; no son cotizaciones ni precios confirmados de proveedores.',
    'El transporte se calcula para el grupo y se divide entre las personas al mostrar el costo individual.',
    'El hospedaje se estima por persona y noche; no implica disponibilidad ni tarifas confirmadas.',
  ]

  if (pointsData.returnToOrigin) {
    assumptions.push('El recorrido incluye ida y regreso al punto de salida.')
  } else {
    assumptions.push(
      'No se incluyó regreso al punto de salida porque el itinerario no define uno.',
    )
  }

  if (resolvedRoute?.source === 'osrm') {
    assumptions.push(
      'Las distancias y tiempos de conducción provienen de OSRM; pueden variar por tráfico, cierres o condiciones de la vía.',
    )
  } else if (pointsData.points.length >= 2) {
    assumptions.push(
      'OSRM no estuvo disponible; la distancia por carretera se estimó a partir de la línea recta con un factor configurable.',
    )
    warnings.push(
      'La distancia y el tiempo de conducción son estimaciones de respaldo, no una ruta calculada por OSRM.',
    )
  }

  for (const name of pointsData.skippedStops ?? []) {
    warnings.push(
      `No se pudo incluir “${name}” en el cálculo de distancia porque no tiene coordenadas válidas.`,
    )
  }

  if (pointsData.points.length < 2) {
    warnings.push(
      'No hay suficientes coordenadas para calcular un recorrido; el transporte se muestra en cero.',
    )
  }

  // Transporte
  let transportMinCents
  let transportMaxCents
  const transportNotes = []
  if (transportMode === 'particular') {
    const liters =
      (distanceMeters / 1000) *
      (finiteNumber(mergedSettings.vehicleConsumptionLitersPer100Km, 8.5) / 100)
    const fuelBase = liters * finiteNumber(mergedSettings.fuelPricePerLiterCents, 0)
    const fuelCents = roundCents(
      fuelBase * (1 + finiteNumber(mergedSettings.fuelSafetyMarginPercent, 0) / 100),
    )
    const parkingCents =
      nonNegativeInteger(mergedSettings.parkingPerDayCents) * days
    const tollsCents = nonNegativeInteger(mergedSettings.tollsPerDayCents) * days
    const total = fuelCents + parkingCents + tollsCents
    ;[transportMinCents, transportMaxCents] = centsRange(total, rangePercent)
    if (distanceMeters > 0) {
      transportNotes.push(
        `Combustible calculado con ${liters.toFixed(2)} L y ${finiteNumber(mergedSettings.fuelSafetyMarginPercent, 0)}% de margen de seguridad.`,
      )
    }
    if (parkingCents > 0) transportNotes.push(`Estacionamiento por ${days} día(s).`)
    if (tollsCents > 0) transportNotes.push(`Peajes por ${days} día(s).`)
    if (distanceMeters === 0) transportNotes.push('No se pudo calcular combustible sin distancia.')
  } else {
    const costLegs =
      legs.length > 0
        ? legs
        : distanceMeters > 0
          ? [{ distanceMeters }]
          : []
    let perPersonCents = 0
    for (const leg of costLegs) {
      const legKm = Math.max(0, finiteNumber(leg.distanceMeters)) / 1000
      const legCost = Math.max(
        nonNegativeInteger(mergedSettings.publicTransportMinimumPerLegCents),
        Math.round(legKm * finiteNumber(mergedSettings.publicTransportPerKmPerPersonCents)),
      )
      perPersonCents += legCost
    }
    const total = perPersonCents * travelers
    ;[transportMinCents, transportMaxCents] = centsRange(total, rangePercent)
    transportNotes.push(
      `Tarifa estimada por tramo y persona; ${costLegs.length} tramo(s) para ${travelers} persona(s).`,
    )
  }
  if (transportNotes.length === 0) transportNotes.push('Sin costo de transporte calculado.')

  // Alimentación
  const mealConfig =
    mergedSettings.mealTiers?.[mealTier] ?? DEFAULT_BUDGET_SETTINGS.mealTiers[mealTier]
  const mealPerPersonDay =
    nonNegativeInteger(mealConfig.breakfastCents) +
    nonNegativeInteger(mealConfig.lunchCents) +
    nonNegativeInteger(mealConfig.dinnerCents) +
    nonNegativeInteger(mealConfig.snackCents)
  const mealTotal = mealPerPersonDay * travelers * days
  const [mealsMinCents, mealsMaxCents] = centsRange(mealTotal, rangePercent)

  // Entradas y actividades
  const priceIndex = entrancePriceIndex(entrancePrices)
  const entranceItems = []
  let admissionsMinCents = 0
  let admissionsMaxCents = 0
  let activitiesCatalogCents = 0
  let verifiedEntrances = 0
  let estimatedEntrances = 0
  let unverifiedEntrances = 0
  const unverifiedNames = []

  for (const stop of Array.isArray(itinerary?.stops) ? itinerary.stops : []) {
    const price = priceForStop(priceIndex, stop)
    const name = stop?.place?.name ?? 'Parada sin nombre'

    if (price) {
      const entrance = entranceAmount(price, adults, children, travelers, rangePercent)
      if (entrance) {
        const verification = price.verificationStatus
        if (verification === 'verified') verifiedEntrances += 1
        else if (verification === 'estimated') estimatedEntrances += 1
        else unverifiedEntrances += 1
        admissionsMinCents += entrance.minCents
        admissionsMaxCents += entrance.maxCents
        entranceItems.push({
          placeId: price.placeId ?? stop?.place?.id ?? null,
          name,
          minCents: entrance.minCents,
          maxCents: entrance.maxCents,
          verification,
          source: price.source ?? 'Catálogo de entradas',
          verifiedAt: price.verifiedAt ?? null,
          note: entrance.note,
        })
      } else {
        unverifiedEntrances += 1
        unverifiedNames.push(name)
        const minCents = nonNegativeInteger(
          mergedSettings.unverifiedEntranceMinPerPersonCents,
        ) * travelers
        const maxCents = nonNegativeInteger(
          mergedSettings.unverifiedEntranceMaxPerPersonCents,
        ) * travelers
        admissionsMinCents += Math.min(minCents, maxCents)
        admissionsMaxCents += Math.max(minCents, maxCents)
        entranceItems.push({
          placeId: price.placeId ?? stop?.place?.id ?? null,
          name,
          minCents: Math.min(minCents, maxCents),
          maxCents: Math.max(minCents, maxCents),
          verification: 'unverified',
          source: price.source ?? 'Sin precio de entrada registrado',
          verifiedAt: null,
          note: 'Precio no verificado; se usa un rango de referencia.',
        })
      }

      if (price.activityCents !== null && price.activityCents !== undefined) {
        activitiesCatalogCents += nonNegativeInteger(price.activityCents) * travelers
      }
    } else {
      unverifiedEntrances += 1
      unverifiedNames.push(name)
      const minCents =
        nonNegativeInteger(mergedSettings.unverifiedEntranceMinPerPersonCents) * travelers
      const maxCents =
        nonNegativeInteger(mergedSettings.unverifiedEntranceMaxPerPersonCents) * travelers
      admissionsMinCents += Math.min(minCents, maxCents)
      admissionsMaxCents += Math.max(minCents, maxCents)
      entranceItems.push({
        placeId: stop?.place?.id ?? null,
        name,
        minCents: Math.min(minCents, maxCents),
        maxCents: Math.max(minCents, maxCents),
        verification: 'unverified',
        source: 'Sin precio de entrada registrado',
        verifiedAt: null,
        note: 'Precio no verificado; se usa un rango de referencia.',
      })
    }
  }

  if (unverifiedNames.length > 0) {
    warnings.push(
      `Precio de entrada no verificado para: ${unverifiedNames.slice(0, 6).join(', ')}${unverifiedNames.length > 6 ? '…' : ''}.`,
    )
    assumptions.push(
      'Las entradas sin precio verificado usan un rango configurable y se muestran como no verificadas.',
    )
  }

  const activityAllowance =
    nonNegativeInteger(mergedSettings.activityAllowancePerPersonPerDayCents) *
    travelers *
    days
  const activityBase = activityAllowance + activitiesCatalogCents
  const [activitiesMinCents, activitiesMaxCents] = centsRange(activityBase, rangePercent)
  const activityNotes = []
  if (activityAllowance > 0) {
    activityNotes.push('Incluye un fondo configurable para actividades no verificadas.')
  }
  if (activitiesCatalogCents > 0) {
    activityNotes.push('Incluye actividades del catálogo de entradas.')
  }

  let admissionsVerification = 'unverified'
  if (verifiedEntrances > 0 && estimatedEntrances === 0 && unverifiedEntrances === 0) {
    admissionsVerification = 'verified'
  } else if (verifiedEntrances > 0 || estimatedEntrances > 0) {
    admissionsVerification =
      unverifiedEntrances > 0 || (verifiedEntrances > 0 && estimatedEntrances > 0)
        ? 'mixed'
        : 'estimated'
  }

  // Hospedaje
  let lodgingMinCents = 0
  let lodgingMaxCents = 0
  if (includeLodging && nights > 0) {
    const rate = nonNegativeInteger(
      mergedSettings.lodgingPerPersonNightCents?.[lodgingTier] ??
        DEFAULT_BUDGET_SETTINGS.lodgingPerPersonNightCents[lodgingTier],
    )
    const total = rate * travelers * nights
    ;[lodgingMinCents, lodgingMaxCents] = centsRange(total, rangePercent)
  }

  const breakdown = [
    {
      key: 'transport',
      label: BUDGET_CATEGORY_LABELS.transport,
      minCents: transportMinCents,
      maxCents: transportMaxCents,
      verification: 'estimated',
      source: transportMode === 'particular' ? 'Combustible y tarifas configurables' : 'Tarifas configurables',
      notes: transportNotes,
    },
    {
      key: 'meals',
      label: BUDGET_CATEGORY_LABELS.meals,
      minCents: mealsMinCents,
      maxCents: mealsMaxCents,
      verification: 'estimated',
      source: 'Tarifas de alimentación configurables',
      notes: [
        `Nivel ${mealTier}: desayuno, almuerzo, cena y refrigerio por persona y día.`,
      ],
    },
    {
      key: 'admissions',
      label: BUDGET_CATEGORY_LABELS.admissions,
      minCents: admissionsMinCents,
      maxCents: admissionsMaxCents,
      verification: admissionsVerification,
      source:
        admissionsVerification === 'verified'
          ? 'Catálogo de entradas verificado'
          : 'Catálogo de entradas y rangos de referencia',
      notes: [
        `${verifiedEntrances} entrada(s) verificada(s), ${estimatedEntrances} estimada(s) y ${unverifiedEntrances} sin verificar.`,
      ],
    },
    {
      key: 'activities',
      label: BUDGET_CATEGORY_LABELS.activities,
      minCents: activitiesMinCents,
      maxCents: activitiesMaxCents,
      verification: 'estimated',
      source: 'Fondo y catálogo de actividades',
      notes: activityNotes,
    },
    {
      key: 'lodging',
      label: BUDGET_CATEGORY_LABELS.lodging,
      minCents: lodgingMinCents,
      maxCents: lodgingMaxCents,
      verification: 'estimated',
      source: 'Tarifas de hospedaje configurables',
      notes: includeLodging
        ? [`${nights} noche(s) para ${travelers} persona(s), nivel ${lodgingTier}.`]
        : ['Hospedaje desactivado para este cálculo.'],
    },
  ]

  const subtotalMin = breakdown.reduce((sum, item) => sum + item.minCents, 0)
  const subtotalMax = breakdown.reduce((sum, item) => sum + item.maxCents, 0)
  const extrasPercent = Math.max(0, Math.min(50, finiteNumber(mergedSettings.extrasPercent, 0)))
  const extrasMinCents = Math.round(subtotalMin * (extrasPercent / 100))
  const extrasMaxCents = Math.round(subtotalMax * (extrasPercent / 100))
  breakdown.push({
    key: 'extras',
    label: BUDGET_CATEGORY_LABELS.extras,
    minCents: extrasMinCents,
    maxCents: extrasMaxCents,
    verification: 'estimated',
    source: 'Porcentaje configurable',
    notes: [`${extrasPercent}% sobre el subtotal estimado.`],
  })

  const totalMinCents = subtotalMin + extrasMinCents
  const totalMaxCents = subtotalMax + extrasMaxCents
  const perPersonMinCents = Math.round(totalMinCents / travelers)
  const perPersonMaxCents = Math.round(totalMaxCents / travelers)
  const perDayMinCents = Math.round(totalMinCents / days)
  const perDayMaxCents = Math.round(totalMaxCents / days)

  let budgetComparison = null
  const declaredBudget = itinerary?.budget
  if (declaredBudget && Number.isFinite(Number(declaredBudget.amount))) {
    const amountCents = Math.max(0, Math.round(Number(declaredBudget.amount) * 100))
    const scope = declaredBudget.scope === 'persona' ? 'persona' : 'total'
    if (String(declaredBudget.currency ?? BUDGET_CURRENCY).toUpperCase() !== BUDGET_CURRENCY) {
      budgetComparison = {
        status: 'unavailable',
        amountCents,
        currency: declaredBudget.currency,
        scope,
        message: 'El presupuesto declarado usa otra moneda; no se comparó con el estimado en USD.',
      }
    } else {
      const basisMin = scope === 'persona' ? perPersonMinCents : totalMinCents
      const basisMax = scope === 'persona' ? perPersonMaxCents : totalMaxCents
      const status =
        basisMax <= amountCents ? 'within' : basisMin > amountCents ? 'over' : 'close'
      budgetComparison = {
        status,
        amountCents,
        currency: BUDGET_CURRENCY,
        scope,
        differenceMinCents: amountCents - basisMin,
        differenceMaxCents: amountCents - basisMax,
      }
      if (status === 'over') {
        warnings.push('El presupuesto declarado está por debajo del rango estimado mínimo.')
      } else if (status === 'close') {
        warnings.push('El presupuesto declarado cae dentro del rango estimado, pero cerca del límite.')
      }
    }
  }

  return {
    currency: BUDGET_CURRENCY,
    generatedAt: new Date(now()).toISOString(),
    pricingSource,
    inputs: {
      travelers,
      adults,
      children,
      days,
      nights,
      transportMode,
      mealTier,
      lodgingTier,
      includeLodging,
      declaredBudget: declaredBudget ?? null,
    },
    route: {
      distanceMeters,
      durationSeconds,
      source: resolvedRoute?.source ?? 'none',
      estimated: resolvedRoute?.estimated !== false,
      returnToOrigin: resolvedRoute?.returnToOrigin === true,
      legs: legs.map((leg) => ({
        fromLabel: leg.fromLabel ?? null,
        toLabel: leg.toLabel ?? null,
        distanceMeters: Math.max(0, roundCents(leg.distanceMeters)),
        durationSeconds: Math.max(0, roundCents(leg.durationSeconds)),
      })),
      skippedStops: pointsData.skippedStops ?? [],
    },
    breakdown,
    totals: {
      minCents: totalMinCents,
      maxCents: totalMaxCents,
      perPersonMinCents,
      perPersonMaxCents,
      perDayMinCents,
      perDayMaxCents,
    },
    verification: {
      entranceStatus: admissionsVerification,
      verifiedEntrances,
      estimatedEntrances,
      unverifiedEntrances,
      allCostsVerified: false,
    },
    entranceItems,
    budgetComparison,
    assumptions,
    warnings,
  }
}
