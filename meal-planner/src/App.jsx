import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

const initialAuthForm = {
  email: '',
  password: '',
}

const emptyIngredient = {
  ingredient_name: '',
  ingredient_base: '',
  quantity_recipe_total: '',
  unit: '',
  category: '',
}

const initialRecipeForm = {
  name: '',
  meal_type: 'pool',
  kcal: '',
  protein_g: '',
  carbs_g: '',
  fat_g: '',
  fiber_g: '',
  recipe_servings: '4',
  prep_minutes: '',
  notes: '',
  ingredients: [{ ...emptyIngredient }],
}

const unitOptions = [
  'g',
  'kg',
  'ml',
  'l',
  'unidad',
  'cucharada',
  'cucharadita',
  'taza',
  'pizca',
]

const categoryOptions = ['Ingrediente', 'Especias']

const initialCatalogForm = {
  ingredient_base: '',
  default_unit: 'g',
  default_category: 'Ingrediente',
}

const mealTypeLabels = {
  pool: 'Pool (variable)',
  pizza_fixed: 'Pizza fija',
  pasta_fixed: 'Pasta fija',
}

const weekSlotDefinitions = [
  { slot_name: 'mon_dinner', label: 'Lun cena', dayOffset: 0, kind: 'pool', defaultStatus: 'recipe' },
  { slot_name: 'tue_dinner', label: 'Mar cena', dayOffset: 1, kind: 'pool', defaultStatus: 'recipe' },
  { slot_name: 'wed_dinner', label: 'Mie cena', dayOffset: 2, kind: 'pool', defaultStatus: 'recipe' },
  { slot_name: 'thu_dinner', label: 'Jue cena', dayOffset: 3, kind: 'pool', defaultStatus: 'recipe' },
  {
    slot_name: 'fri_dinner_pizza',
    label: 'Vie cena (pizza)',
    dayOffset: 4,
    kind: 'pizza_fixed',
    defaultStatus: 'fixed',
  },
  {
    slot_name: 'sat_lunch_pasta',
    label: 'Sab comida (pasta)',
    dayOffset: 5,
    kind: 'pasta_fixed',
    defaultStatus: 'fixed',
  },
  { slot_name: 'sat_dinner', label: 'Sab cena', dayOffset: 5, kind: 'pool', defaultStatus: 'recipe' },
  { slot_name: 'sun_lunch', label: 'Dom comida', dayOffset: 6, kind: 'pool', defaultStatus: 'recipe' },
  { slot_name: 'sun_dinner', label: 'Dom cena', dayOffset: 6, kind: 'pool', defaultStatus: 'recipe' },
]

const slotOrder = weekSlotDefinitions.reduce((acc, item, index) => {
  acc[item.slot_name] = index
  return acc
}, {})

const initialManualItemForm = {
  item_name: '',
  quantity: '',
  unit: '',
  is_recurring: false,
}

const initialProfileForm = {
  name: '',
  sex: 'female',
  age_years: '',
  weight_kg: '',
  height_cm: '',
  activity_level: 'moderate',
  goal: 'maintain',
}

const activityFactorMap = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
}

const formatDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseDate = (iso) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const addDays = (date, days) => {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value
}

const stripAccents = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const descriptorWords = new Set([
  'cortado',
  'cortada',
  'cortados',
  'cortadas',
  'picado',
  'picada',
  'picados',
  'picadas',
  'pelado',
  'pelada',
  'pelados',
  'peladas',
  'dados',
  'trozos',
  'rodajas',
  'grande',
  'grandes',
  'fino',
  'fina',
  'finos',
  'finas',
  'en',
  'con',
  'sin',
  'y',
  'al',
  'la',
  'el',
  'los',
  'las',
])

const normalizeIngredientName = (rawName) => {
  const base = stripAccents((rawName || '').toLowerCase())
    .replace(/\(.*?\)/g, ' ')
    .split(',')[0]
    .trim()

  const tokens = base.split(/\s+/).filter(Boolean).filter((token) => !descriptorWords.has(token))
  const finalTokens = tokens.length > 0 ? tokens : base.split(/\s+/).filter(Boolean)

  if (finalTokens.length > 0 && finalTokens[0].length > 3 && finalTokens[0].endsWith('s')) {
    finalTokens[0] = finalTokens[0].slice(0, -1)
  }

  return finalTokens.slice(0, 4).join(' ').trim() || base || 'ingrediente'
}

const normalizeUnit = (rawUnit) => {
  const value = stripAccents((rawUnit || '').toLowerCase()).trim()
  if (!value) return 'unidad'

  const map = {
    gr: 'g',
    gramo: 'g',
    gramos: 'g',
    kilo: 'kg',
    kilos: 'kg',
    unidad: 'unidad',
    unidades: 'unidad',
    ud: 'unidad',
    uds: 'unidad',
    ccs: 'ml',
    cc: 'ml',
  }

  return map[value] || value
}

const simpleHash = (value) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

const getNextMonday = () => {
  const today = new Date()
  const day = today.getDay()
  const daysUntilMonday = ((8 - day) % 7) || 7
  return formatDate(addDays(today, daysUntilMonday))
}

const daysBetween = (fromIso, toIso) => {
  const from = parseDate(fromIso)
  const to = parseDate(toIso)
  return Math.floor((to - from) / (1000 * 60 * 60 * 24))
}

const recipeFlags = (recipe) => {
  if (!recipe) return { isRisotto: false, hasRice: false, hasBeef: false }
  const recipeText = stripAccents((recipe.name || '').toLowerCase())
  const ingredientsText = (recipe.recipe_ingredients || [])
    .map((item) => stripAccents((item.ingredient_base || item.ingredient_name || '').toLowerCase()))
    .join(' ')

  const isRisotto = recipeText.includes('risotto')
  const hasRice = isRisotto || recipeText.includes('arroz') || ingredientsText.includes('arroz')
  const hasBeef = recipeText.includes('ternera') || ingredientsText.includes('ternera')

  return { isRisotto, hasRice, hasBeef }
}

const formatMonthLabel = (startMondayIso) => {
  const date = parseDate(startMondayIso)
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(date)
}

const formatDayLabel = (isoDate) => {
  const date = parseDate(isoDate)
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', '')
}

const formatCoverageStatus = (coverageRatio) => {
  if (!Number.isFinite(coverageRatio) || coverageRatio <= 0) return 'bajo'
  if (coverageRatio < 0.7) return 'bajo'
  if (coverageRatio < 0.9) return 'medio'
  if (coverageRatio <= 1.1) return 'ok'
  if (coverageRatio <= 1.25) return 'alto'
  return 'exceso'
}

const nutrientStatus = (consumed, target) => {
  if (!Number.isFinite(target) || target <= 0) return 'medio'
  const ratio = consumed / target
  if (ratio < 0.7) return 'bajo'
  if (ratio < 0.9) return 'medio'
  if (ratio <= 1.1) return 'ok'
  if (ratio <= 1.25) return 'alto'
  return 'exceso'
}

const calculateTargets = (profile) => {
  const weight = Number(profile.weight_kg) || 0
  const height = Number(profile.height_cm) || 0
  const age = Number(profile.age_years) || 0
  if (!weight || !height || !age) return null

  const sex = profile.sex || 'female'
  const activityFactor = activityFactorMap[profile.activity_level] || 1.55
  const goal = profile.goal || 'maintain'

  const sexOffset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78
  const ree = 10 * weight + 6.25 * height - 5 * age + sexOffset
  const tdee = ree * activityFactor
  const kcalTarget = goal === 'lose' ? tdee * 0.85 : goal === 'gain' ? tdee * 1.1 : tdee

  const proteinPerKg = goal === 'lose' ? 2 : goal === 'gain' ? 1.8 : 1.6
  const proteinG = weight * proteinPerKg
  const fatKcal = kcalTarget * 0.3
  const fatG = fatKcal / 9
  const remainingKcal = Math.max(kcalTarget - proteinG * 4 - fatG * 9, 0)
  const carbsG = remainingKcal / 4
  const fiberG = (kcalTarget / 1000) * 14

  return {
    ree,
    tdee,
    kcalTarget,
    proteinG,
    carbsG,
    fatG,
    fiberG,
  }
}

function App() {
  const [session, setSession] = useState(null)
  const [authForm, setAuthForm] = useState(initialAuthForm)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [activeView, setActiveView] = useState('recipes')

  const [recipes, setRecipes] = useState([])
  const [recipesLoading, setRecipesLoading] = useState(false)
  const [recipesError, setRecipesError] = useState('')
  const [recipeForm, setRecipeForm] = useState(initialRecipeForm)
  const [recipeSaving, setRecipeSaving] = useState(false)
  const [recipeMessage, setRecipeMessage] = useState('')
  const [editingRecipeId, setEditingRecipeId] = useState(null)
  const [recipeSearch, setRecipeSearch] = useState('')
  const [selectedRecipeId, setSelectedRecipeId] = useState('')

  const [defaultServings, setDefaultServings] = useState(3)
  const [planStartMonday, setPlanStartMonday] = useState(getNextMonday())
  const [regenerateSeed, setRegenerateSeed] = useState(0)
  const [planSlots, setPlanSlots] = useState([])
  const [planCycleId, setPlanCycleId] = useState(null)
  const [plannerLoading, setPlannerLoading] = useState(false)
  const [plannerSaving, setPlannerSaving] = useState(false)
  const [plannerMessage, setPlannerMessage] = useState('')
  const [plannerError, setPlannerError] = useState('')
  const [savedPlans, setSavedPlans] = useState([])
  const [savedPlansLoading, setSavedPlansLoading] = useState(false)
  const [savedPlanSearch, setSavedPlanSearch] = useState('')
  const [profiles, setProfiles] = useState([])
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [profilesError, setProfilesError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileForm, setProfileForm] = useState(initialProfileForm)
  const [editingProfileId, setEditingProfileId] = useState(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [dailyCoverageProfileId, setDailyCoverageProfileId] = useState('')
  const [ingredientCatalog, setIngredientCatalog] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [catalogMessage, setCatalogMessage] = useState('')
  const [catalogForm, setCatalogForm] = useState(initialCatalogForm)
  const [catalogSaving, setCatalogSaving] = useState(false)

  const [shoppingWeekOffset, setShoppingWeekOffset] = useState(0)
  const [shoppingPlanCycleId, setShoppingPlanCycleId] = useState('')
  const [shoppingPlanStartMonday, setShoppingPlanStartMonday] = useState('')
  const [shoppingPlanSlots, setShoppingPlanSlots] = useState([])
  const [shoppingPlanLoading, setShoppingPlanLoading] = useState(false)
  const [shoppingWeekId, setShoppingWeekId] = useState(null)
  const [manualItems, setManualItems] = useState([])
  const [manualLoading, setManualLoading] = useState(false)
  const [manualItemForm, setManualItemForm] = useState(initialManualItemForm)
  const [shoppingMessage, setShoppingMessage] = useState('')
  const [shoppingError, setShoppingError] = useState('')

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session ?? null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const userEmail = useMemo(() => session?.user?.email ?? '', [session])
  const userId = useMemo(() => session?.user?.id ?? '', [session])

  const recipesById = useMemo(() => {
    const map = new Map()
    for (const recipe of recipes) map.set(recipe.id, recipe)
    return map
  }, [recipes])

  const sortedRecipes = useMemo(
    () => [...recipes].sort((a, b) => a.name.localeCompare(b.name)),
    [recipes],
  )

  const filteredRecipeOptions = useMemo(() => {
    const term = recipeSearch.trim().toLowerCase()
    if (!term) return sortedRecipes
    return sortedRecipes.filter((recipe) => recipe.name.toLowerCase().includes(term))
  }, [sortedRecipes, recipeSearch])

  const visibleRecipes = useMemo(() => {
    if (selectedRecipeId) {
      const selected = recipes.find((recipe) => recipe.id === selectedRecipeId)
      return selected ? [selected] : []
    }
    return filteredRecipeOptions
  }, [recipes, selectedRecipeId, filteredRecipeOptions])

  const poolRecipes = useMemo(() => recipes.filter((recipe) => recipe.meal_type === 'pool'), [recipes])
  const pizzaRecipes = useMemo(
    () => recipes.filter((recipe) => recipe.meal_type === 'pizza_fixed'),
    [recipes],
  )
  const pastaRecipes = useMemo(
    () => recipes.filter((recipe) => recipe.meal_type === 'pasta_fixed'),
    [recipes],
  )

  const selectedWeekMonday = useMemo(() => {
    if (!shoppingPlanStartMonday) return ''
    return formatDate(addDays(parseDate(shoppingPlanStartMonday), shoppingWeekOffset * 7))
  }, [shoppingPlanStartMonday, shoppingWeekOffset])

  const weekAutoItems = useMemo(() => {
    const totals = new Map()

    for (const slot of shoppingPlanSlots) {
      const dayDelta = daysBetween(shoppingPlanStartMonday, slot.slot_date)
      const slotWeekIndex = Math.floor(dayDelta / 7)
      if (slotWeekIndex !== shoppingWeekOffset) continue
      if (slot.status === 'out') continue
      if (!slot.recipe_id) continue

      const recipe = recipesById.get(slot.recipe_id)
      if (!recipe?.recipe_ingredients) continue

      const servings = slot.servings_override || defaultServings
      const recipeServings = Number(recipe.recipe_servings) > 0 ? Number(recipe.recipe_servings) : 1
      const scaleFactor = servings / recipeServings

      for (const ingredient of recipe.recipe_ingredients) {
        const categoryRaw = ingredient.category || 'General'
        const categoryNormalized = stripAccents(categoryRaw.toLowerCase())
        if (categoryNormalized.includes('especia')) continue

        const normalizedName = normalizeIngredientName(
          ingredient.ingredient_base || ingredient.ingredient_name,
        )
        const normalizedUnit = normalizeUnit(ingredient.unit)
        const key = `${normalizedName}|${normalizedUnit}`
        const current = totals.get(key) || {
          ingredient_name: normalizedName,
          unit: normalizedUnit,
          category: categoryRaw,
          quantity: 0,
        }
        const totalPerRecipe = Number(
          ingredient.quantity_recipe_total ??
            Number(ingredient.quantity_per_serving || 0) * recipeServings,
        )
        current.quantity += totalPerRecipe * scaleFactor
        totals.set(key, current)
      }
    }

    return [...totals.values()].sort((a, b) => {
      if (a.category === b.category) return a.ingredient_name.localeCompare(b.ingredient_name)
      return a.category.localeCompare(b.category)
    })
  }, [shoppingPlanSlots, recipesById, shoppingPlanStartMonday, shoppingWeekOffset, defaultServings])

  const activeProfiles = useMemo(
    () => profiles.filter((profile) => profile.is_active !== false),
    [profiles],
  )

  const selectedDailyProfile = useMemo(() => {
    if (activeProfiles.length === 0) return null
    if (!dailyCoverageProfileId) return activeProfiles[0]
    return activeProfiles.find((profile) => profile.id === dailyCoverageProfileId) || activeProfiles[0]
  }, [activeProfiles, dailyCoverageProfileId])

  const weeklyNutritionByProfile = useMemo(() => {
    if (activeProfiles.length === 0 || !shoppingPlanStartMonday) return []

    const slotsInWeek = shoppingPlanSlots.filter((slot) => {
      const dayDelta = daysBetween(shoppingPlanStartMonday, slot.slot_date)
      return Math.floor(dayDelta / 7) === shoppingWeekOffset && slot.status !== 'out' && slot.recipe_id
    })

    return activeProfiles.map((profile) => {
      const targets = calculateTargets(profile)
      const consumed = {
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      }

      for (const slot of slotsInWeek) {
        const recipe = recipesById.get(slot.recipe_id)
        if (!recipe) continue
        const slotServings = Number(slot.servings_override || defaultServings) || 0
        const portionsPerPerson = slotServings / activeProfiles.length

        consumed.kcal += Number(recipe.kcal || 0) * portionsPerPerson
        consumed.protein += Number(recipe.protein_g || 0) * portionsPerPerson
        consumed.carbs += Number(recipe.carbs_g || 0) * portionsPerPerson
        consumed.fat += Number(recipe.fat_g || 0) * portionsPerPerson
        consumed.fiber += Number(recipe.fiber_g || 0) * portionsPerPerson
      }

      return {
        profile,
        targets,
        consumed,
      }
    })
  }, [activeProfiles, shoppingPlanSlots, shoppingPlanStartMonday, shoppingWeekOffset, recipesById, defaultServings])

  const dailyCoverageRows = useMemo(() => {
    if (!shoppingPlanStartMonday || !selectedWeekMonday || activeProfiles.length === 0 || !selectedDailyProfile) {
      return []
    }

    const slotsInWeek = shoppingPlanSlots.filter((slot) => {
      const dayDelta = daysBetween(shoppingPlanStartMonday, slot.slot_date)
      return Math.floor(dayDelta / 7) === shoppingWeekOffset && slot.status !== 'out' && slot.recipe_id
    })

    const slotsByDate = new Map()
    for (const slot of slotsInWeek) {
      const existing = slotsByDate.get(slot.slot_date) || []
      existing.push(slot)
      slotsByDate.set(slot.slot_date, existing)
    }

    const targets = calculateTargets(selectedDailyProfile)
    const targetDaily = targets
      ? {
          kcal: targets.kcalTarget,
          protein: targets.proteinG,
          carbs: targets.carbsG,
          fat: targets.fatG,
          fiber: targets.fiberG,
        }
      : null

    return [0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
      const dayIso = formatDate(addDays(parseDate(selectedWeekMonday), dayOffset))
      const daySlots = slotsByDate.get(dayIso) || []
      const consumed = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      const slotDetails = []

      for (const slot of daySlots) {
        const recipe = recipesById.get(slot.recipe_id)
        if (!recipe) continue

        const slotServings = Number(slot.servings_override || defaultServings) || 0
        const portionsPerPerson = slotServings / activeProfiles.length
        const detail = {
          label: weekSlotDefinitions.find((item) => item.slot_name === slot.slot_name)?.label || slot.slot_name,
          recipeName: recipe.name,
          kcal: Number(recipe.kcal || 0) * portionsPerPerson,
          protein: Number(recipe.protein_g || 0) * portionsPerPerson,
          carbs: Number(recipe.carbs_g || 0) * portionsPerPerson,
          fat: Number(recipe.fat_g || 0) * portionsPerPerson,
          fiber: Number(recipe.fiber_g || 0) * portionsPerPerson,
        }

        consumed.kcal += detail.kcal
        consumed.protein += detail.protein
        consumed.carbs += detail.carbs
        consumed.fat += detail.fat
        consumed.fiber += detail.fiber
        slotDetails.push(detail)
      }

      const balance = targetDaily
        ? {
            kcal: targetDaily.kcal - consumed.kcal,
            protein: targetDaily.protein - consumed.protein,
            carbs: targetDaily.carbs - consumed.carbs,
            fat: targetDaily.fat - consumed.fat,
            fiber: targetDaily.fiber - consumed.fiber,
          }
        : null

      const coverageRatio = targetDaily ? consumed.kcal / Math.max(targetDaily.kcal, 1) : 0
      return {
        dayIso,
        dayLabel: formatDayLabel(dayIso),
        consumed,
        targetDaily,
        balance,
        slotDetails,
        status: formatCoverageStatus(coverageRatio),
        coveragePercent: coverageRatio * 100,
      }
    })
  }, [
    shoppingPlanStartMonday,
    selectedWeekMonday,
    activeProfiles,
    selectedDailyProfile,
    shoppingPlanSlots,
    shoppingWeekOffset,
    recipesById,
    defaultServings,
  ])

  useEffect(() => {
    if (activeProfiles.length === 0) {
      setDailyCoverageProfileId('')
      return
    }
    if (!dailyCoverageProfileId || !activeProfiles.some((profile) => profile.id === dailyCoverageProfileId)) {
      setDailyCoverageProfileId(activeProfiles[0].id)
    }
  }, [activeProfiles, dailyCoverageProfileId])

  const plannerWeekGroups = useMemo(() => {
    const groups = [0, 1, 2, 3].map((weekIndex) => {
      const weekStart = formatDate(addDays(parseDate(planStartMonday), weekIndex * 7))
      const weekEnd = formatDate(addDays(parseDate(weekStart), 6))
      const slots = planSlots.filter((slot) => {
        const dayDelta = daysBetween(planStartMonday, slot.slot_date)
        return Math.floor(dayDelta / 7) === weekIndex
      })
      return {
        weekIndex,
        weekStart,
        weekEnd,
        slots,
      }
    })
    return groups
  }, [planSlots, planStartMonday])

  const filteredSavedPlans = useMemo(() => {
    const term = savedPlanSearch.trim().toLowerCase()
    if (!term) return savedPlans

    return savedPlans.filter((plan) => {
      const label = formatMonthLabel(plan.start_monday)
      return (
        label.toLowerCase().includes(term) ||
        plan.start_monday.includes(term) ||
        (plan.strategy || '').toLowerCase().includes(term)
      )
    })
  }, [savedPlans, savedPlanSearch])

  useEffect(() => {
    if (!userId) {
      setRecipes([])
      setPlanSlots([])
      setManualItems([])
      setPlanCycleId(null)
      setSelectedRecipeId('')
      setSavedPlans([])
      setProfiles([])
      setIngredientCatalog([])
      return
    }

    loadRecipes(userId)
    loadProfile(userId)
    loadSavedPlans(userId)
    loadProfiles(userId)
    loadIngredientCatalog(userId)
  }, [userId])

  const catalogByBase = useMemo(() => {
    const map = new Map()
    for (const item of ingredientCatalog) {
      map.set((item.ingredient_base || '').trim().toLowerCase(), item)
    }
    return map
  }, [ingredientCatalog])

  useEffect(() => {
    if (!userId) return
    loadOrCreatePlanner(userId, planStartMonday)
  }, [userId, planStartMonday, recipes.length])

  useEffect(() => {
    if (!userId || !selectedWeekMonday) return
    loadManualItems(userId, selectedWeekMonday)
  }, [userId, selectedWeekMonday])

  useEffect(() => {
    if (!shoppingPlanCycleId) {
      setShoppingPlanSlots([])
      return
    }
    loadShoppingPlanSlots(shoppingPlanCycleId)
  }, [shoppingPlanCycleId])

  useEffect(() => {
    if (recipes.length === 0) {
      setSelectedRecipeId('')
      return
    }
    if (selectedRecipeId && !recipes.some((recipe) => recipe.id === selectedRecipeId)) {
      setSelectedRecipeId('')
    }
  }, [recipes, selectedRecipeId])

  const handleChange = (event) => {
    const { name, value } = event.target
    setAuthForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSignIn = async (event) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    const { error } = await supabase.auth.signInWithPassword({
      email: authForm.email,
      password: authForm.password,
    })

    if (error) setAuthError(error.message)
    setAuthLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const resetRecipeForm = () => {
    setRecipeForm(initialRecipeForm)
    setEditingRecipeId(null)
    setRecipesError('')
  }

  const loadProfile = async (ownerUserId) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('default_servings')
      .eq('user_id', ownerUserId)
      .maybeSingle()

    if (error) return
    if (data?.default_servings) {
      setDefaultServings(data.default_servings)
    }
  }

  const loadSavedPlans = async (ownerUserId) => {
    setSavedPlansLoading(true)
    const { data, error } = await supabase
      .from('plan_cycles')
      .select('id, start_monday, weeks_count, strategy, created_at')
      .eq('user_id', ownerUserId)
      .order('start_monday', { ascending: false })

    if (!error) {
      const nextPlans = data ?? []
      setSavedPlans(nextPlans)
      if (nextPlans.length > 0) {
        const selectedExists = nextPlans.some((plan) => plan.id === shoppingPlanCycleId)
        if (!selectedExists) {
          setShoppingPlanCycleId(nextPlans[0].id)
          setShoppingPlanStartMonday(nextPlans[0].start_monday)
          setShoppingWeekOffset(0)
        }
      } else {
        setShoppingPlanCycleId('')
        setShoppingPlanStartMonday('')
        setShoppingPlanSlots([])
      }
    }
    setSavedPlansLoading(false)
  }

  const loadProfiles = async (ownerUserId) => {
    setProfilesLoading(true)
    setProfilesError('')
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, sex, age_years, weight_kg, height_cm, activity_level, goal, is_active')
      .eq('user_id', ownerUserId)
      .order('name', { ascending: true })

    if (error) {
      setProfilesError(error.message)
      setProfilesLoading(false)
      return
    }

    setProfiles(data ?? [])
    setProfilesLoading(false)
  }

  const loadShoppingPlanSlots = async (planCycleId) => {
    if (!planCycleId) {
      setShoppingPlanSlots([])
      return
    }

    setShoppingPlanLoading(true)
    const { data, error } = await supabase
      .from('plan_slots')
      .select('slot_date, slot_name, status, recipe_id, servings_override')
      .eq('plan_cycle_id', planCycleId)

    if (!error) {
      const normalized = sortSlots(
        (data ?? []).map((slot) => ({
          ...slot,
          local_id: `${slot.slot_date}_${slot.slot_name}`,
        })),
      )
      setShoppingPlanSlots(normalized)
    } else {
      setShoppingPlanSlots([])
      setShoppingError(error.message)
    }
    setShoppingPlanLoading(false)
  }

  const loadIngredientCatalog = async (ownerUserId) => {
    setCatalogLoading(true)
    setCatalogError('')
    const { data, error } = await supabase
      .from('ingredient_catalog')
      .select('id, ingredient_base, default_unit, default_category, is_active')
      .eq('user_id', ownerUserId)
      .eq('is_active', true)
      .order('ingredient_base', { ascending: true })

    if (error) {
      setCatalogError(error.message)
      setCatalogLoading(false)
      return
    }

    setIngredientCatalog(data ?? [])
    setCatalogLoading(false)
  }

  const persistDefaultServings = async (value) => {
    if (!userId) return
    await supabase.from('user_profiles').upsert({
      user_id: userId,
      default_servings: value,
    })
  }

  const loadRecipes = async (ownerUserId) => {
    setRecipesLoading(true)
    setRecipesError('')

    const { data, error } = await supabase
      .from('recipes')
      .select(
        'id, name, meal_type, kcal, protein_g, carbs_g, fat_g, fiber_g, recipe_servings, prep_minutes, notes, created_at, recipe_ingredients(*)',
      )
      .eq('user_id', ownerUserId)
      .order('created_at', { ascending: false })

    if (error) {
      setRecipesError(error.message)
      setRecipesLoading(false)
      return
    }

    setRecipes(data ?? [])
    setRecipesLoading(false)
  }

  const chooseDefaultRecipeId = (kind) => {
    if (kind === 'pizza_fixed') return pizzaRecipes[0]?.id ?? null
    if (kind === 'pasta_fixed') return pastaRecipes[0]?.id ?? null
    return poolRecipes[0]?.id ?? null
  }

  const generatePlanSlots = (startMondayIso, seed = 0) => {
    const startDate = parseDate(startMondayIso)
    const generated = []
    const useCount = {}
    const lastUsedAt = {}

    for (let week = 0; week < 4; week += 1) {
      const weekState = {
        risottoCount: 0,
        riceCount: 0,
        beefByDate: {},
      }

      for (const definition of weekSlotDefinitions) {
        const slotDate = formatDate(addDays(startDate, week * 7 + definition.dayOffset))
        const previousDate = formatDate(addDays(parseDate(slotDate), -1))
        let recipeId = null

        if (definition.kind === 'pool') {
          let candidates = poolRecipes.filter((recipe) => {
            const last = lastUsedAt[recipe.id]
            if (!last) return true
            return daysBetween(last, slotDate) >= 10
          })

          const meetsWeekRules = (recipe) => {
            const flags = recipeFlags(recipe)
            if (flags.isRisotto && weekState.risottoCount >= 1) return false
            if (flags.hasRice && weekState.riceCount >= 2) return false
            if (flags.hasBeef && weekState.beefByDate[previousDate]) return false
            return true
          }

          let constrainedCandidates = candidates.filter(meetsWeekRules)

          if (constrainedCandidates.length === 0) {
            constrainedCandidates = poolRecipes.filter(meetsWeekRules)
          }
          if (constrainedCandidates.length === 0) {
            constrainedCandidates = candidates.length > 0 ? candidates : [...poolRecipes]
          }

          constrainedCandidates.sort((a, b) => {
            const aCount = useCount[a.id] || 0
            const bCount = useCount[b.id] || 0
            if (aCount !== bCount) return aCount - bCount

            const aLast = lastUsedAt[a.id] || '1900-01-01'
            const bLast = lastUsedAt[b.id] || '1900-01-01'
            if (aLast !== bLast) return aLast.localeCompare(bLast)
            const aHash = simpleHash(`${a.id}|${slotDate}|${seed}`)
            const bHash = simpleHash(`${b.id}|${slotDate}|${seed}`)
            if (aHash !== bHash) return aHash - bHash
            return a.name.localeCompare(b.name)
          })

          recipeId = constrainedCandidates[0]?.id ?? null

          if (recipeId) {
            useCount[recipeId] = (useCount[recipeId] || 0) + 1
            lastUsedAt[recipeId] = slotDate
          }
        } else {
          recipeId = chooseDefaultRecipeId(definition.kind)
        }

        const selectedRecipe =
          definition.kind === 'pool'
            ? poolRecipes.find((recipe) => recipe.id === recipeId)
            : recipes.find((recipe) => recipe.id === recipeId)
        const flags = recipeFlags(selectedRecipe)
        if (flags.isRisotto) weekState.risottoCount += 1
        if (flags.hasRice) weekState.riceCount += 1
        if (flags.hasBeef) weekState.beefByDate[slotDate] = true

        generated.push({
          local_id: `${slotDate}_${definition.slot_name}`,
          slot_date: slotDate,
          slot_name: definition.slot_name,
          label: definition.label,
          kind: definition.kind,
          status: definition.defaultStatus,
          recipe_id: recipeId,
          servings_override: null,
        })
      }
    }

    return generated
  }

  const sortSlots = (slots) =>
    [...slots].sort((a, b) => {
      if (a.slot_date !== b.slot_date) return a.slot_date.localeCompare(b.slot_date)
      return (slotOrder[a.slot_name] ?? 0) - (slotOrder[b.slot_name] ?? 0)
    })

  const loadOrCreatePlanner = async (ownerUserId, startMondayIso) => {
    setPlannerLoading(true)
    setPlannerError('')

    const { data: cycle, error: cycleError } = await supabase
      .from('plan_cycles')
      .select('id, start_monday')
      .eq('user_id', ownerUserId)
      .eq('start_monday', startMondayIso)
      .maybeSingle()

    if (cycleError) {
      setPlannerLoading(false)
      setPlannerError(cycleError.message)
      return
    }

    if (!cycle?.id) {
      setPlanCycleId(null)
      setPlanSlots(sortSlots(generatePlanSlots(startMondayIso, regenerateSeed)))
      setPlannerLoading(false)
      return
    }

    const { data: slotsData, error: slotsError } = await supabase
      .from('plan_slots')
      .select('id, slot_date, slot_name, status, recipe_id, servings_override')
      .eq('plan_cycle_id', cycle.id)

    if (slotsError) {
      setPlannerLoading(false)
      setPlannerError(slotsError.message)
      return
    }

    const base = generatePlanSlots(startMondayIso, regenerateSeed)
    const byKey = new Map(base.map((slot) => [`${slot.slot_date}_${slot.slot_name}`, slot]))

    for (const dbSlot of slotsData || []) {
      const key = `${dbSlot.slot_date}_${dbSlot.slot_name}`
      const existing = byKey.get(key)
      if (!existing) continue

      existing.status = dbSlot.status
      existing.recipe_id = dbSlot.recipe_id
      existing.servings_override = dbSlot.servings_override
    }

    setPlanCycleId(cycle.id)
    setPlanSlots(sortSlots([...byKey.values()]))
    setPlannerLoading(false)
  }

  const handleRecipeFieldChange = (event) => {
    const { name, value } = event.target
    setRecipeForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleIngredientChange = (index, field, value) => {
    setRecipeForm((prev) => {
      const updatedIngredients = [...prev.ingredients]
      if (field === 'ingredient_base') {
        const normalized = (value || '').trim().toLowerCase()
        const catalogItem = catalogByBase.get(normalized)
        updatedIngredients[index] = {
          ...updatedIngredients[index],
          ingredient_base: value,
          unit: catalogItem?.default_unit || updatedIngredients[index].unit,
          category: catalogItem?.default_category || updatedIngredients[index].category,
        }
      } else {
        updatedIngredients[index] = {
          ...updatedIngredients[index],
          [field]: value,
        }
      }
      return {
        ...prev,
        ingredients: updatedIngredients,
      }
    })
  }

  const addIngredient = () => {
    setRecipeForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { ...emptyIngredient }],
    }))
  }

  const removeIngredient = (index) => {
    setRecipeForm((prev) => {
      if (prev.ingredients.length === 1) {
        return { ...prev, ingredients: [{ ...emptyIngredient }] }
      }
      return {
        ...prev,
        ingredients: prev.ingredients.filter((_, itemIndex) => itemIndex !== index),
      }
    })
  }

  const toOptionalNumber = (value) => {
    if (value === '') return null
    return Number(value)
  }

  const toRequiredNumber = (value) => Number(value)

  const buildIngredientPayload = (recipeId, recipeServings) =>
    recipeForm.ingredients
      .map((item) => ({
        recipe_id: recipeId,
        ingredient_name: item.ingredient_name.trim(),
        ingredient_base: (item.ingredient_base || normalizeIngredientName(item.ingredient_name)).trim(),
        quantity_recipe_total: toRequiredNumber(item.quantity_recipe_total),
        quantity_per_serving: toRequiredNumber(item.quantity_recipe_total) / recipeServings,
        unit: item.unit.trim(),
        category: item.category.trim() || null,
      }))
      .filter(
        (item) =>
          item.ingredient_name !== '' &&
          item.unit !== '' &&
          Number.isFinite(item.quantity_recipe_total) &&
          item.quantity_recipe_total > 0,
      )

  const handleSaveRecipe = async (event) => {
    event.preventDefault()
    setRecipeSaving(true)
    setRecipeMessage('')
    setRecipesError('')

    const recipePayload = {
      user_id: userId,
      name: recipeForm.name.trim(),
      meal_type: recipeForm.meal_type,
      kcal: toRequiredNumber(recipeForm.kcal),
      protein_g: toRequiredNumber(recipeForm.protein_g),
      carbs_g: toRequiredNumber(recipeForm.carbs_g),
      fat_g: toRequiredNumber(recipeForm.fat_g),
      fiber_g: toRequiredNumber(recipeForm.fiber_g),
      recipe_servings: toRequiredNumber(recipeForm.recipe_servings),
      prep_minutes: toOptionalNumber(recipeForm.prep_minutes),
      notes: recipeForm.notes.trim() || null,
    }

    if (!recipePayload.name) {
      setRecipesError('Recipe name is required.')
      setRecipeSaving(false)
      return
    }

    if (
      !Number.isFinite(recipePayload.kcal) ||
      !Number.isFinite(recipePayload.protein_g) ||
      !Number.isFinite(recipePayload.carbs_g) ||
      !Number.isFinite(recipePayload.fat_g) ||
      !Number.isFinite(recipePayload.fiber_g) ||
      !Number.isFinite(recipePayload.recipe_servings) ||
      recipePayload.recipe_servings <= 0
    ) {
      setRecipesError('Nutrition fields and servings must be valid numbers.')
      setRecipeSaving(false)
      return
    }

    let recipeId = editingRecipeId

    if (editingRecipeId) {
      const { error: updateError } = await supabase
        .from('recipes')
        .update(recipePayload)
        .eq('id', editingRecipeId)
        .eq('user_id', userId)

      if (updateError) {
        setRecipesError(updateError.message)
        setRecipeSaving(false)
        return
      }

      const { error: deleteIngredientsError } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', editingRecipeId)

      if (deleteIngredientsError) {
        setRecipesError(deleteIngredientsError.message)
        setRecipeSaving(false)
        return
      }
    } else {
      const { data: createdRecipe, error: createError } = await supabase
        .from('recipes')
        .insert(recipePayload)
        .select('id')
        .single()

      if (createError) {
        setRecipesError(createError.message)
        setRecipeSaving(false)
        return
      }

      recipeId = createdRecipe.id
    }

    const ingredientsPayload = buildIngredientPayload(recipeId, recipePayload.recipe_servings)

    if (ingredientsPayload.length > 0) {
      const { error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientsPayload)

      if (ingredientsError) {
        setRecipesError(ingredientsError.message)
        setRecipeSaving(false)
        return
      }
    }

    const successMessage = editingRecipeId ? 'Recipe updated.' : 'Recipe created.'
    resetRecipeForm()
    await loadRecipes(userId)
    setRecipeMessage(successMessage)
    setRecipeSaving(false)
  }

  const handleEditRecipe = (recipe) => {
    const recipeServings = Number(recipe.recipe_servings) > 0 ? Number(recipe.recipe_servings) : 1
    const recipeIngredients =
      recipe.recipe_ingredients?.length > 0
        ? recipe.recipe_ingredients.map((item) => ({
            ingredient_name: item.ingredient_name,
            ingredient_base: item.ingredient_base ?? normalizeIngredientName(item.ingredient_name),
            quantity_recipe_total: String(
              item.quantity_recipe_total ?? Number(item.quantity_per_serving || 0) * recipeServings,
            ),
            unit: item.unit,
            category: item.category ?? '',
          }))
        : [{ ...emptyIngredient }]

    setRecipeForm({
      name: recipe.name,
      meal_type: recipe.meal_type,
      kcal: String(recipe.kcal),
      protein_g: String(recipe.protein_g),
      carbs_g: String(recipe.carbs_g),
      fat_g: String(recipe.fat_g),
      fiber_g: String(recipe.fiber_g ?? ''),
      recipe_servings: String(recipe.recipe_servings ?? 4),
      prep_minutes: recipe.prep_minutes ? String(recipe.prep_minutes) : '',
      notes: recipe.notes ?? '',
      ingredients: recipeIngredients,
    })

    setEditingRecipeId(recipe.id)
    setRecipeMessage('')
    setRecipesError('')
  }

  const handleDeleteRecipe = async (recipeId, recipeName) => {
    const shouldDelete = window.confirm(`Delete recipe "${recipeName}"?`)
    if (!shouldDelete) return

    setRecipesError('')
    setRecipeMessage('')

    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId)
      .eq('user_id', userId)

    if (error) {
      setRecipesError(error.message)
      return
    }

    if (editingRecipeId === recipeId) resetRecipeForm()
    if (selectedRecipeId === recipeId) {
      setSelectedRecipeId('')
    }

    setRecipeMessage('Recipe deleted.')
    await loadRecipes(userId)
  }

  const resetProfileForm = () => {
    setProfileForm(initialProfileForm)
    setEditingProfileId(null)
    setProfilesError('')
    setProfileMessage('')
  }

  const handleProfileFieldChange = (event) => {
    const { name, value, type, checked } = event.target
    setProfileForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    if (!userId) return

    setProfilesError('')
    setProfileMessage('')
    setProfileSaving(true)

    const payload = {
      user_id: userId,
      name: profileForm.name.trim(),
      sex: profileForm.sex,
      age_years: Number(profileForm.age_years),
      weight_kg: Number(profileForm.weight_kg),
      height_cm: Number(profileForm.height_cm),
      activity_level: profileForm.activity_level,
      goal: profileForm.goal,
      is_active: true,
    }

    if (
      !payload.name ||
      !Number.isFinite(payload.age_years) ||
      !Number.isFinite(payload.weight_kg) ||
      !Number.isFinite(payload.height_cm)
    ) {
      setProfilesError('Completa nombre, edad, peso y altura.')
      setProfileSaving(false)
      return
    }

    if (editingProfileId) {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', editingProfileId)
        .eq('user_id', userId)
      if (error) {
        setProfilesError(error.message)
        setProfileSaving(false)
        return
      }
    } else {
      const { error } = await supabase.from('profiles').insert(payload)
      if (error) {
        setProfilesError(error.message)
        setProfileSaving(false)
        return
      }
    }

    const successMessage = editingProfileId ? 'Perfil actualizado.' : 'Perfil creado.'
    await loadProfiles(userId)
    resetProfileForm()
    setProfileMessage(successMessage)
    setProfileSaving(false)
  }

  const handleEditProfile = (profile) => {
    setProfileForm({
      name: profile.name || '',
      sex: profile.sex || 'female',
      age_years: String(profile.age_years ?? ''),
      weight_kg: String(profile.weight_kg ?? ''),
      height_cm: String(profile.height_cm ?? ''),
      activity_level: profile.activity_level || 'moderate',
      goal: profile.goal || 'maintain',
    })
    setEditingProfileId(profile.id)
    setProfilesError('')
    setProfileMessage('')
  }

  const handleDeleteProfile = async (profileId) => {
    if (!userId) return
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', profileId)
      .eq('user_id', userId)

    if (error) {
      setProfilesError(error.message)
      return
    }

    if (editingProfileId === profileId) resetProfileForm()
    setProfileMessage('Perfil eliminado.')
    await loadProfiles(userId)
  }

  const handleRegeneratePlan = () => {
    const nextSeed = Date.now()
    setRegenerateSeed(nextSeed)
    setPlanSlots(sortSlots(generatePlanSlots(planStartMonday, nextSeed)))
    setPlannerMessage('Plan regenerated.')
    setPlannerError('')
  }

  const handleRegenerateWeek = (weekIndex) => {
    const nextSeed = Date.now() + weekIndex
    setRegenerateSeed(nextSeed)
    setPlanSlots((prev) => {
      const regeneratedAll = generatePlanSlots(planStartMonday, nextSeed)
      const regeneratedByKey = new Map(
        regeneratedAll.map((slot) => [`${slot.slot_date}_${slot.slot_name}`, slot]),
      )

      return sortSlots(
        prev.map((slot) => {
          const dayDelta = daysBetween(planStartMonday, slot.slot_date)
          const slotWeekIndex = Math.floor(dayDelta / 7)
          if (slotWeekIndex !== weekIndex) return slot
          const replacement = regeneratedByKey.get(`${slot.slot_date}_${slot.slot_name}`)
          return replacement ? { ...replacement, local_id: slot.local_id } : slot
        }),
      )
    })
    setPlannerMessage(`Semana ${weekIndex + 1} regenerada.`)
    setPlannerError('')
  }

  const handleSlotToggleOut = (localId, isOut) => {
    setPlanSlots((prev) =>
      prev.map((slot) => {
        if (slot.local_id !== localId) return slot

        if (isOut) {
          return { ...slot, status: 'out', recipe_id: null }
        }

        const status = slot.kind === 'pool' ? 'recipe' : 'fixed'
        return {
          ...slot,
          status,
          recipe_id: slot.recipe_id || chooseDefaultRecipeId(slot.kind),
        }
      }),
    )
  }

  const recipeOptionsByKind = (kind) => {
    if (kind === 'pizza_fixed') return pizzaRecipes
    if (kind === 'pasta_fixed') return pastaRecipes
    return poolRecipes
  }

  const handleSlotRecipeChange = (localId, recipeId) => {
    setPlanSlots((prev) =>
      prev.map((slot) => (slot.local_id === localId ? { ...slot, recipe_id: recipeId || null } : slot)),
    )
  }

  const handleSlotServingsChange = (localId, value) => {
    setPlanSlots((prev) =>
      prev.map((slot) => {
        if (slot.local_id !== localId) return slot
        const parsed = value === '' ? null : Number(value)
        return { ...slot, servings_override: Number.isFinite(parsed) ? parsed : null }
      }),
    )
  }

  const handleSavePlan = async () => {
    if (!userId) return

    setPlannerSaving(true)
    setPlannerError('')
    setPlannerMessage('')

    const { data: cycle, error: cycleError } = await supabase
      .from('plan_cycles')
      .upsert(
        {
          user_id: userId,
          start_monday: planStartMonday,
          weeks_count: 4,
          strategy: 'variety_first',
        },
        { onConflict: 'user_id,start_monday' },
      )
      .select('id')
      .single()

    if (cycleError) {
      setPlannerSaving(false)
      setPlannerError(cycleError.message)
      return
    }

    const cycleId = cycle.id

    const { error: deleteError } = await supabase
      .from('plan_slots')
      .delete()
      .eq('plan_cycle_id', cycleId)

    if (deleteError) {
      setPlannerSaving(false)
      setPlannerError(deleteError.message)
      return
    }

    const payload = planSlots.map((slot) => ({
      plan_cycle_id: cycleId,
      slot_date: slot.slot_date,
      slot_name: slot.slot_name,
      status: slot.status,
      recipe_id: slot.status === 'out' ? null : slot.recipe_id,
      servings_override: slot.servings_override,
    }))

    const { error: insertError } = await supabase.from('plan_slots').insert(payload)

    if (insertError) {
      setPlannerSaving(false)
      setPlannerError(insertError.message)
      return
    }

    setPlanCycleId(cycleId)
    setPlannerSaving(false)
    setPlannerMessage('Plan saved.')
    await loadSavedPlans(userId)
    if (shoppingPlanCycleId === cycleId) {
      await loadShoppingPlanSlots(cycleId)
    }
  }

  const handleLoadSavedPlan = async (savedPlan) => {
    setPlanStartMonday(savedPlan.start_monday)
    setActiveView('planner')
    setPlannerMessage(`Plan cargado: ${formatMonthLabel(savedPlan.start_monday)}.`)
    setPlannerError('')
  }

  const ensureShoppingWeek = async (ownerUserId, weekMondayIso) => {
    const { data: existing, error: existingError } = await supabase
      .from('shopping_weeks')
      .select('id')
      .eq('user_id', ownerUserId)
      .eq('week_monday', weekMondayIso)
      .maybeSingle()

    if (existingError) throw new Error(existingError.message)
    if (existing?.id) return existing.id

    const { data: created, error: createError } = await supabase
      .from('shopping_weeks')
      .insert({
        user_id: ownerUserId,
        week_monday: weekMondayIso,
        plan_cycle_id: planCycleId,
      })
      .select('id')
      .single()

    if (createError) throw new Error(createError.message)
    return created.id
  }

  const loadManualItems = async (ownerUserId, weekMondayIso) => {
    setManualLoading(true)
    setShoppingError('')

    const { data: week, error: weekError } = await supabase
      .from('shopping_weeks')
      .select('id')
      .eq('user_id', ownerUserId)
      .eq('week_monday', weekMondayIso)
      .maybeSingle()

    if (weekError) {
      setManualLoading(false)
      setShoppingError(weekError.message)
      return
    }

    if (!week?.id) {
      setShoppingWeekId(null)
      setManualItems([])
      setManualLoading(false)
      return
    }

    const { data: items, error: itemsError } = await supabase
      .from('shopping_manual_items')
      .select('id, item_name, quantity, unit, is_recurring, is_checked')
      .eq('shopping_week_id', week.id)
      .order('created_at', { ascending: true })

    if (itemsError) {
      setManualLoading(false)
      setShoppingError(itemsError.message)
      return
    }

    setShoppingWeekId(week.id)
    setManualItems(items ?? [])
    setManualLoading(false)
  }

  const handleAddManualItem = async (event) => {
    event.preventDefault()
    if (!userId) return
    if (!selectedWeekMonday) return
    if (!manualItemForm.item_name.trim()) return

    setShoppingError('')
    setShoppingMessage('')

    try {
      const weekId = await ensureShoppingWeek(userId, selectedWeekMonday)
      const { error } = await supabase.from('shopping_manual_items').insert({
        shopping_week_id: weekId,
        item_name: manualItemForm.item_name.trim(),
        quantity: manualItemForm.quantity === '' ? null : Number(manualItemForm.quantity),
        unit: manualItemForm.unit.trim() || null,
        is_recurring: manualItemForm.is_recurring,
      })

      if (error) throw new Error(error.message)

      setManualItemForm(initialManualItemForm)
      setShoppingMessage('Extra item added.')
      await loadManualItems(userId, selectedWeekMonday)
    } catch (error) {
      setShoppingError(error.message)
    }
  }

  const handleDeleteManualItem = async (itemId) => {
    const { error } = await supabase.from('shopping_manual_items').delete().eq('id', itemId)
    if (error) {
      setShoppingError(error.message)
      return
    }

    setShoppingMessage('Extra item removed.')
    await loadManualItems(userId, selectedWeekMonday)
  }

  const handleCatalogFieldChange = (event) => {
    const { name, value } = event.target
    setCatalogForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaveCatalogItem = async (event) => {
    event.preventDefault()
    if (!userId) return
    if (!catalogForm.ingredient_base.trim()) {
      setCatalogError('Completa ingrediente base.')
      return
    }

    setCatalogSaving(true)
    setCatalogError('')
    setCatalogMessage('')

    const payload = {
      user_id: userId,
      ingredient_base: catalogForm.ingredient_base.trim().toLowerCase(),
      default_unit: catalogForm.default_unit,
      default_category: catalogForm.default_category,
      is_active: true,
    }

    const { error } = await supabase.from('ingredient_catalog').insert(payload)
    if (error) {
      setCatalogSaving(false)
      setCatalogError(error.message)
      return
    }

    setCatalogForm(initialCatalogForm)
    setCatalogMessage('Ingrediente base agregado.')
    setCatalogSaving(false)
    await loadIngredientCatalog(userId)
  }

  const handleDeleteCatalogItem = async (id) => {
    if (!userId) return
    const { error } = await supabase
      .from('ingredient_catalog')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      setCatalogError(error.message)
      return
    }

    setCatalogMessage('Ingrediente base desactivado.')
    await loadIngredientCatalog(userId)
  }

  const renderRecipesView = () => (
    <div className="grid-two grid-two-recipes">
      <section className="panel recipe-form-panel">
        <h2>{editingRecipeId ? 'Edit recipe' : 'New recipe'}</h2>
        <p className="muted">Ingredientes por receta completa (no por porcion).</p>

        <form className="form" onSubmit={handleSaveRecipe}>
          <label>
            Name
            <input
              name="name"
              value={recipeForm.name}
              onChange={handleRecipeFieldChange}
              placeholder="Chicken bowl"
              required
            />
          </label>

          <label>
            Type
            <select name="meal_type" value={recipeForm.meal_type} onChange={handleRecipeFieldChange}>
              <option value="pool">Pool (variable)</option>
              <option value="pizza_fixed">Pizza fija</option>
              <option value="pasta_fixed">Pasta fija</option>
            </select>
          </label>

          <label>
            Recipe servings (rinde para)
            <input
              type="number"
              min="1"
              step="1"
              name="recipe_servings"
              value={recipeForm.recipe_servings}
              onChange={handleRecipeFieldChange}
              required
            />
          </label>

          <div className="row-four">
            <label>
              Kcal
              <input
                type="number"
                min="0"
                step="0.01"
                name="kcal"
                value={recipeForm.kcal}
                onChange={handleRecipeFieldChange}
                required
              />
            </label>
            <label>
              Protein (g)
              <input
                type="number"
                min="0"
                step="0.01"
                name="protein_g"
                value={recipeForm.protein_g}
                onChange={handleRecipeFieldChange}
                required
              />
            </label>
            <label>
              Carbs (g)
              <input
                type="number"
                min="0"
                step="0.01"
                name="carbs_g"
                value={recipeForm.carbs_g}
                onChange={handleRecipeFieldChange}
                required
              />
            </label>
            <label>
              Fat (g)
              <input
                type="number"
                min="0"
                step="0.01"
                name="fat_g"
                value={recipeForm.fat_g}
                onChange={handleRecipeFieldChange}
                required
              />
            </label>
            <label>
              Fiber (g)
              <input
                type="number"
                min="0"
                step="0.01"
                name="fiber_g"
                value={recipeForm.fiber_g}
                onChange={handleRecipeFieldChange}
                required
              />
            </label>
          </div>

          <label>
            Prep minutes
            <input
              type="number"
              min="0"
              name="prep_minutes"
              value={recipeForm.prep_minutes}
              onChange={handleRecipeFieldChange}
              placeholder="Optional"
            />
          </label>

          <label>
            Notes
            <textarea
              name="notes"
              value={recipeForm.notes}
              onChange={handleRecipeFieldChange}
              placeholder="Optional notes"
            />
          </label>

          <div className="ingredients-box">
            <div className="ingredients-head">
              <h3>Ingredients</h3>
              <button type="button" className="button-secondary small" onClick={addIngredient}>
                Add
              </button>
            </div>

            {recipeForm.ingredients.map((ingredient, index) => (
              <div key={index} className="ingredient-row">
                <input
                  className="ing-name"
                  placeholder="Ingredient"
                  value={ingredient.ingredient_name}
                  onChange={(event) =>
                    handleIngredientChange(index, 'ingredient_name', event.target.value)
                  }
                />
                <input
                  className="ing-base"
                  list="ingredient-base-options"
                  placeholder="Base (ej: pollo)"
                  value={ingredient.ingredient_base}
                  onChange={(event) =>
                    handleIngredientChange(index, 'ingredient_base', event.target.value)
                  }
                />
                <input
                  className="ing-qty"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Qty total receta"
                  value={ingredient.quantity_recipe_total}
                  onChange={(event) =>
                    handleIngredientChange(index, 'quantity_recipe_total', event.target.value)
                  }
                />
                <select
                  className="ing-unit"
                  value={ingredient.unit}
                  onChange={(event) => handleIngredientChange(index, 'unit', event.target.value)}
                >
                  <option value="">Unidad</option>
                  {unitOptions.map((unitOption) => (
                    <option key={unitOption} value={unitOption}>
                      {unitOption}
                    </option>
                  ))}
                  {ingredient.unit && !unitOptions.includes(ingredient.unit) ? (
                    <option value={ingredient.unit}>{ingredient.unit}</option>
                  ) : null}
                </select>
                <select
                  className="ing-category"
                  value={ingredient.category}
                  onChange={(event) => handleIngredientChange(index, 'category', event.target.value)}
                >
                  <option value="">Categoría</option>
                  {categoryOptions.map((categoryOption) => (
                    <option key={categoryOption} value={categoryOption}>
                      {categoryOption}
                    </option>
                  ))}
                  {ingredient.category && !categoryOptions.includes(ingredient.category) ? (
                    <option value={ingredient.category}>{ingredient.category}</option>
                  ) : null}
                </select>
                <button
                  type="button"
                  className="button-danger small ing-remove"
                  onClick={() => removeIngredient(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {recipesError ? <p className="error">{recipesError}</p> : null}
          {recipeMessage ? <p className="success">{recipeMessage}</p> : null}

          <div className="button-row">
            <button type="submit" disabled={recipeSaving}>
              {recipeSaving ? 'Saving...' : editingRecipeId ? 'Update recipe' : 'Create recipe'}
            </button>
            {editingRecipeId ? (
              <button type="button" className="button-secondary" onClick={resetRecipeForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel recipes-panel">
        <h2>Your recipes</h2>
        <div className="recipe-picker">
          <label>
            Buscar
            <input
              placeholder="Ej: pollo"
              value={recipeSearch}
              onChange={(event) => setRecipeSearch(event.target.value)}
            />
          </label>
          <label>
            Elegir receta
            <select
              value={selectedRecipeId}
              onChange={(event) => setSelectedRecipeId(event.target.value)}
            >
              <option value="">Todas las filtradas</option>
              {filteredRecipeOptions.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {recipesLoading ? <p className="muted">Loading recipes...</p> : null}
        {!recipesLoading && recipes.length === 0 ? (
          <p className="muted">No recipes yet. Create your first recipe.</p>
        ) : null}
        {!recipesLoading && recipes.length > 0 && visibleRecipes.length === 0 ? (
          <p className="muted">No hay recetas con ese filtro.</p>
        ) : null}
        <div className="list">
          {visibleRecipes.map((recipe) => (
            <article key={recipe.id} className="list-item">
              <div className="list-top">
                <h3>{recipe.name}</h3>
                <span className="pill">{mealTypeLabels[recipe.meal_type] ?? recipe.meal_type}</span>
              </div>
              <p className="muted compact">
                {recipe.kcal} kcal | P {recipe.protein_g}g | C {recipe.carbs_g}g | F {recipe.fat_g}g | Fib{' '}
                {recipe.fiber_g ?? 0}g
              </p>
              <p className="muted compact">
                {recipe.recipe_ingredients?.length ?? 0} ingredients
                {recipe.recipe_servings ? ` | rinde ${recipe.recipe_servings}` : ''}
                {recipe.prep_minutes ? ` | ${recipe.prep_minutes} min` : ''}
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="button-secondary small"
                  onClick={() => handleEditRecipe(recipe)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="button-danger small"
                  onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )

  const renderCatalogView = () => (
    <div className="grid-two">
      <section className="panel">
        <h2>Parametrización</h2>
        <p className="muted">Define ingredientes base, unidad y categoría por defecto.</p>
        <form className="form" onSubmit={handleSaveCatalogItem}>
          <label>
            Ingrediente base
            <input
              name="ingredient_base"
              placeholder="ej: cebolla"
              value={catalogForm.ingredient_base}
              onChange={handleCatalogFieldChange}
              required
            />
          </label>
          <div className="row-two">
            <label>
              Unidad por defecto
              <select
                name="default_unit"
                value={catalogForm.default_unit}
                onChange={handleCatalogFieldChange}
              >
                {unitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categoría por defecto
              <select
                name="default_category"
                value={catalogForm.default_category}
                onChange={handleCatalogFieldChange}
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {catalogError ? <p className="error">{catalogError}</p> : null}
          {catalogMessage ? <p className="success">{catalogMessage}</p> : null}
          <button type="submit" disabled={catalogSaving}>
            {catalogSaving ? 'Guardando...' : 'Guardar ingrediente base'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Ingredientes base cargados</h2>
        {catalogLoading ? <p className="muted">Cargando catálogo...</p> : null}
        {!catalogLoading && ingredientCatalog.length === 0 ? (
          <p className="muted">No hay ingredientes base aún.</p>
        ) : null}
        <div className="list">
          {ingredientCatalog.map((item) => (
            <article className="list-item" key={item.id}>
              <div className="list-top">
                <h3>{item.ingredient_base}</h3>
                <span className="pill">
                  {item.default_unit} | {item.default_category}
                </span>
              </div>
              <button
                type="button"
                className="button-danger small"
                onClick={() => handleDeleteCatalogItem(item.id)}
              >
                Desactivar
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )

  const renderPlannerView = () => (
    <section className="panel">
      <div className="planner-top">
        <h2>Planner 4 semanas</h2>
        <div className="planner-controls">
          <label>
            Inicio (lunes)
            <input
              type="date"
              value={planStartMonday}
              onChange={(event) => setPlanStartMonday(event.target.value)}
            />
          </label>
          <label>
            Personas default
            <input
              type="number"
              min="1"
              value={defaultServings}
              onChange={(event) => {
                const nextValue = Number(event.target.value) || 1
                setDefaultServings(nextValue)
                persistDefaultServings(nextValue)
              }}
            />
          </label>
        </div>
      </div>

      <div className="button-row">
        <button type="button" onClick={handleRegeneratePlan}>
          Regenerar plan
        </button>
        <button type="button" onClick={handleSavePlan} disabled={plannerSaving}>
          {plannerSaving ? 'Guardando...' : 'Guardar plan'}
        </button>
      </div>

      {plannerError ? <p className="error">{plannerError}</p> : null}
      {plannerMessage ? <p className="success">{plannerMessage}</p> : null}

      {plannerLoading ? <p className="muted">Cargando plan...</p> : null}
      {!plannerLoading
        ? plannerWeekGroups.map((group) => (
            <section className="week-section" key={group.weekIndex}>
              <div className="week-header">
                <h3>Semana {group.weekIndex + 1}</h3>
                <div className="week-actions">
                  <span className="slot-date">
                    {group.weekStart} a {group.weekEnd}
                  </span>
                  <button
                    type="button"
                    className="button-secondary small"
                    onClick={() => handleRegenerateWeek(group.weekIndex)}
                  >
                    Regenerar semana
                  </button>
                </div>
              </div>
              <div className="slot-grid">
                {group.slots.map((slot) => {
                  const slotRecipeOptions = recipeOptionsByKind(slot.kind)
                  const recipeName = slot.recipe_id ? recipesById.get(slot.recipe_id)?.name : 'Sin receta'
                  return (
                    <article className="slot-card" key={slot.local_id}>
                      <div className="slot-head">
                        <h3>{slot.label}</h3>
                        <span className="slot-date">{slot.slot_date}</span>
                      </div>
                      <label className="inline-row">
                        <input
                          type="checkbox"
                          checked={slot.status === 'out'}
                          onChange={(event) => handleSlotToggleOut(slot.local_id, event.target.checked)}
                        />
                        Fuera
                      </label>

                      {slot.status !== 'out' ? (
                        <>
                          <label>
                            Receta
                            <select
                              value={slot.recipe_id || ''}
                              onChange={(event) => handleSlotRecipeChange(slot.local_id, event.target.value)}
                            >
                              <option value="">Seleccionar</option>
                              {slotRecipeOptions.map((recipe) => (
                                <option key={recipe.id} value={recipe.id}>
                                  {recipe.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Personas
                            <input
                              type="number"
                              min="1"
                              value={slot.servings_override ?? ''}
                              placeholder={String(defaultServings)}
                              onChange={(event) =>
                                handleSlotServingsChange(slot.local_id, event.target.value)
                              }
                            />
                          </label>
                        </>
                      ) : (
                        <p className="muted compact">Marcado como fuera.</p>
                      )}

                      <p className="muted compact">
                        {slot.status === 'out' ? 'Sin compra' : recipeName}
                      </p>
                    </article>
                  )
                })}
              </div>
            </section>
          ))
        : null}

      <p className="muted compact">
        Reglas activas: prioridad variedad, no repetir receta en 10 dias, max 1 risotto/semana, sin
        ternera en dias consecutivos y arroz max 2 veces/semana.
      </p>
      {planCycleId ? <p className="muted compact">Plan guardado (id: {planCycleId}).</p> : null}
    </section>
  )

  const renderShoppingView = () => (
    <div className="grid-two">
      <section className="panel">
        <div className="planner-top">
          <h2>Compra semanal</h2>
          <button
            type="button"
            className="button-secondary"
            onClick={() => loadSavedPlans(userId)}
            disabled={savedPlansLoading}
          >
            {savedPlansLoading ? 'Actualizando...' : 'Actualizar planes'}
          </button>
        </div>
        <div className="row-two">
          <label>
            Mes (plan guardado)
            <select
              value={shoppingPlanCycleId}
              onChange={(event) => {
                const nextCycleId = event.target.value
                const selectedPlan = savedPlans.find((plan) => plan.id === nextCycleId)
                setShoppingPlanCycleId(nextCycleId)
                setShoppingPlanStartMonday(selectedPlan?.start_monday ?? '')
                setShoppingWeekOffset(0)
              }}
            >
              <option value="">Seleccionar plan</option>
              {savedPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {formatMonthLabel(plan.start_monday)} ({plan.start_monday})
                </option>
              ))}
            </select>
          </label>
          <label>
            Semana
            <select
              value={shoppingWeekOffset}
              onChange={(event) => setShoppingWeekOffset(Number(event.target.value))}
              disabled={!shoppingPlanCycleId}
            >
              <option value={0}>Semana 1</option>
              <option value={1}>Semana 2</option>
              <option value={2}>Semana 3</option>
              <option value={3}>Semana 4</option>
            </select>
          </label>
        </div>
        <p className="muted compact">Lunes: {selectedWeekMonday || '-'}</p>

        {shoppingPlanLoading ? <p className="muted">Cargando plan seleccionado...</p> : null}
        {!shoppingPlanCycleId ? (
          <p className="muted">Selecciona un plan guardado para ver la compra semanal.</p>
        ) : null}
        {shoppingPlanCycleId && !shoppingPlanLoading && weekAutoItems.length === 0 ? (
          <p className="muted">No hay items automaticos para esta semana.</p>
        ) : null}
        {shoppingPlanCycleId && !shoppingPlanLoading && weekAutoItems.length > 0 ? (
          <div className="list">
            {weekAutoItems.map((item) => (
              <article className="list-item" key={`${item.ingredient_name}|${item.unit}|${item.category}`}>
                <div className="list-top">
                  <h3>{item.ingredient_name}</h3>
                  <span className="pill">{item.category}</span>
                </div>
                <p className="muted compact">
                  {item.quantity.toFixed(2)} {item.unit}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Extras manuales</h2>
        <form className="form" onSubmit={handleAddManualItem}>
          <label>
            Item
            <input
              value={manualItemForm.item_name}
              onChange={(event) =>
                setManualItemForm((prev) => ({ ...prev, item_name: event.target.value }))
              }
              required
            />
          </label>
          <div className="row-two">
            <label>
              Cantidad
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualItemForm.quantity}
                onChange={(event) =>
                  setManualItemForm((prev) => ({ ...prev, quantity: event.target.value }))
                }
              />
            </label>
            <label>
              Unidad
              <input
                value={manualItemForm.unit}
                onChange={(event) =>
                  setManualItemForm((prev) => ({ ...prev, unit: event.target.value }))
                }
              />
            </label>
          </div>
          <label className="inline-row">
            <input
              type="checkbox"
              checked={manualItemForm.is_recurring}
              onChange={(event) =>
                setManualItemForm((prev) => ({ ...prev, is_recurring: event.target.checked }))
              }
            />
            Recurrente
          </label>
          <button type="submit">Agregar extra</button>
        </form>

        {shoppingError ? <p className="error">{shoppingError}</p> : null}
        {shoppingMessage ? <p className="success">{shoppingMessage}</p> : null}

        {manualLoading ? (
          <p className="muted">Cargando extras...</p>
        ) : manualItems.length === 0 ? (
          <p className="muted">Sin extras para esta semana.</p>
        ) : (
          <div className="list">
            {manualItems.map((item) => (
              <article className="list-item" key={item.id}>
                <div className="list-top">
                  <h3>{item.item_name}</h3>
                  {item.is_recurring ? <span className="pill">Recurrente</span> : null}
                </div>
                <p className="muted compact">
                  {item.quantity ?? '-'} {item.unit ?? ''}
                </p>
                <button
                  type="button"
                  className="button-danger small"
                  onClick={() => handleDeleteManualItem(item.id)}
                >
                  Borrar
                </button>
              </article>
            ))}
          </div>
        )}
        {shoppingWeekId ? <p className="muted compact">Semana guardada en DB.</p> : null}
      </section>
    </div>
  )

  const renderSavedPlansView = () => (
    <section className="panel">
      <div className="planner-top">
        <h2>Planes guardados</h2>
        <button
          type="button"
          className="button-secondary"
          onClick={() => loadSavedPlans(userId)}
          disabled={savedPlansLoading}
        >
          {savedPlansLoading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      <label>
        Buscar por mes
        <input
          placeholder="Ej: marzo 2026"
          value={savedPlanSearch}
          onChange={(event) => setSavedPlanSearch(event.target.value)}
        />
      </label>

      {savedPlansLoading ? <p className="muted">Cargando planes...</p> : null}
      {!savedPlansLoading && filteredSavedPlans.length === 0 ? (
        <p className="muted">No hay planes guardados para ese filtro.</p>
      ) : null}

      <div className="list">
        {filteredSavedPlans.map((plan) => (
          <article className="list-item" key={plan.id}>
            <div className="list-top">
              <h3>{formatMonthLabel(plan.start_monday)}</h3>
              <span className="pill">{plan.start_monday}</span>
            </div>
            <p className="muted compact">Inicio: {plan.start_monday} | {plan.weeks_count} semanas</p>
            <div className="button-row">
              <button type="button" className="button-secondary small" onClick={() => handleLoadSavedPlan(plan)}>
                Abrir plan
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )

  const renderProfilesView = () => (
    <div className="grid-two grid-two-recipes">
      <section className="panel recipe-form-panel">
        <h2>{editingProfileId ? 'Editar perfil' : 'Nuevo perfil'}</h2>
        <p className="muted">Datos para calcular necesidades nutricionales por persona.</p>

        <form className="form" onSubmit={handleSaveProfile}>
          <label>
            Nombre
            <input name="name" value={profileForm.name} onChange={handleProfileFieldChange} required />
          </label>

          <div className="row-two">
            <label>
              Sexo
              <select name="sex" value={profileForm.sex} onChange={handleProfileFieldChange}>
                <option value="female">Mujer</option>
                <option value="male">Hombre</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <label>
              Edad
              <input
                type="number"
                min="1"
                name="age_years"
                value={profileForm.age_years}
                onChange={handleProfileFieldChange}
                required
              />
            </label>
          </div>

          <div className="row-two">
            <label>
              Peso (kg)
              <input
                type="number"
                min="1"
                step="0.1"
                name="weight_kg"
                value={profileForm.weight_kg}
                onChange={handleProfileFieldChange}
                required
              />
            </label>
            <label>
              Altura (cm)
              <input
                type="number"
                min="1"
                name="height_cm"
                value={profileForm.height_cm}
                onChange={handleProfileFieldChange}
                required
              />
            </label>
          </div>

          <div className="row-two">
            <label>
              Actividad
              <select
                name="activity_level"
                value={profileForm.activity_level}
                onChange={handleProfileFieldChange}
              >
                <option value="sedentary">Sedentario</option>
                <option value="light">Ligero</option>
                <option value="moderate">Moderado</option>
                <option value="very_active">Muy activo</option>
                <option value="extra_active">Extra activo</option>
              </select>
            </label>
            <label>
              Objetivo
              <select name="goal" value={profileForm.goal} onChange={handleProfileFieldChange}>
                <option value="maintain">Mantener</option>
                <option value="lose">Perder</option>
                <option value="gain">Ganar</option>
              </select>
            </label>
          </div>

          {profilesError ? <p className="error">{profilesError}</p> : null}
          {profileMessage ? <p className="success">{profileMessage}</p> : null}

          <div className="button-row">
            <button type="submit" disabled={profileSaving}>
              {profileSaving ? 'Guardando...' : editingProfileId ? 'Actualizar perfil' : 'Crear perfil'}
            </button>
            {editingProfileId ? (
              <button type="button" className="button-secondary" onClick={resetProfileForm}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel recipes-panel">
        <h2>Perfiles y resumen semanal</h2>
        <p className="muted compact">
          Semana analizada: {selectedWeekMonday || '-'} (usa `Compra semanal` para elegir mes y semana).
        </p>

        {profilesLoading ? <p className="muted">Cargando perfiles...</p> : null}
        {!profilesLoading && profiles.length === 0 ? (
          <p className="muted">No hay perfiles todavía.</p>
        ) : null}
        {!profilesLoading && profiles.length > 0 && !shoppingPlanStartMonday ? (
          <p className="muted">Selecciona un plan guardado en la pestaña Compra semanal para ver el resumen.</p>
        ) : null}
        <div className="list">
          {weeklyNutritionByProfile.map((entry) => {
            const { profile, targets, consumed } = entry
            const kcalTargetWeekly = targets ? targets.kcalTarget * 7 : 0
            const proteinTargetWeekly = targets ? targets.proteinG * 7 : 0
            const carbsTargetWeekly = targets ? targets.carbsG * 7 : 0
            const fatTargetWeekly = targets ? targets.fatG * 7 : 0
            const fiberTargetWeekly = targets ? targets.fiberG * 7 : 0

            return (
              <article className="list-item" key={profile.id}>
                <div className="list-top">
                  <h3>{profile.name}</h3>
                  <span className="pill">{profile.goal}</span>
                </div>
                <p className="muted compact">
                  {profile.sex} | {profile.age_years} años | {profile.weight_kg} kg | {profile.height_cm} cm
                </p>
                <p className="muted compact">
                  Kcal semana: {consumed.kcal.toFixed(0)} / {kcalTargetWeekly.toFixed(0)}
                </p>
                <p className="muted compact">
                  P {consumed.protein.toFixed(1)} / {proteinTargetWeekly.toFixed(1)} g | C{' '}
                  {consumed.carbs.toFixed(1)} / {carbsTargetWeekly.toFixed(1)} g
                </p>
                <p className="muted compact">
                  F {consumed.fat.toFixed(1)} / {fatTargetWeekly.toFixed(1)} g | Fib{' '}
                  {consumed.fiber.toFixed(1)} / {fiberTargetWeekly.toFixed(1)} g
                </p>
                <div className="button-row">
                  <button type="button" className="button-secondary small" onClick={() => handleEditProfile(profile)}>
                    Editar
                  </button>
                  <button type="button" className="button-danger small" onClick={() => handleDeleteProfile(profile.id)}>
                    Borrar
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )

  const renderDailyCoverageView = () => {
    const getComplements = (balance) => {
      if (!balance) return []
      const suggestions = []
      if (balance.protein > 15) suggestions.push(`+${balance.protein.toFixed(0)}g proteína`)
      if (balance.carbs > 30) suggestions.push(`+${balance.carbs.toFixed(0)}g carbohidratos`)
      if (balance.fat > 10) suggestions.push(`+${balance.fat.toFixed(0)}g grasa`)
      if (balance.fiber > 6) suggestions.push(`+${balance.fiber.toFixed(0)}g fibra`)
      return suggestions
    }

    const nutrientMeta = [
      { key: 'kcal', label: 'Kcal', unit: '' },
      { key: 'protein', label: 'Proteína', unit: 'g' },
      { key: 'carbs', label: 'Carbohidratos', unit: 'g' },
      { key: 'fat', label: 'Grasa', unit: 'g' },
      { key: 'fiber', label: 'Fibra', unit: 'g' },
    ]

    return (
      <section className="panel">
        <div className="planner-top">
          <h2>Cobertura diaria</h2>
          <button
            type="button"
            className="button-secondary"
            onClick={() => loadSavedPlans(userId)}
            disabled={savedPlansLoading}
          >
            {savedPlansLoading ? 'Actualizando...' : 'Actualizar planes'}
          </button>
        </div>

        <div className="row-coverage">
          <label>
            Mes (plan guardado)
            <select
              value={shoppingPlanCycleId}
              onChange={(event) => {
                const nextCycleId = event.target.value
                const selectedPlan = savedPlans.find((plan) => plan.id === nextCycleId)
                setShoppingPlanCycleId(nextCycleId)
                setShoppingPlanStartMonday(selectedPlan?.start_monday ?? '')
                setShoppingWeekOffset(0)
              }}
            >
              <option value="">Seleccionar plan</option>
              {savedPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {formatMonthLabel(plan.start_monday)} ({plan.start_monday})
                </option>
              ))}
            </select>
          </label>

          <label>
            Semana
            <select
              value={shoppingWeekOffset}
              onChange={(event) => setShoppingWeekOffset(Number(event.target.value))}
              disabled={!shoppingPlanCycleId}
            >
              <option value={0}>Semana 1</option>
              <option value={1}>Semana 2</option>
              <option value={2}>Semana 3</option>
              <option value={3}>Semana 4</option>
            </select>
          </label>

          <label>
            Persona
            <select
              value={dailyCoverageProfileId}
              onChange={(event) => setDailyCoverageProfileId(event.target.value)}
              disabled={activeProfiles.length === 0}
            >
              {activeProfiles.length === 0 ? <option value="">Sin perfiles</option> : null}
              {activeProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="muted compact">Semana analizada (lunes): {selectedWeekMonday || '-'}</p>
        <p className="muted compact">Rojo en kcal = cobertura energética baja en ese día (te faltan calorías).</p>

        {shoppingPlanLoading ? <p className="muted">Cargando plan seleccionado...</p> : null}
        {!shoppingPlanCycleId ? <p className="muted">Selecciona un plan guardado.</p> : null}
        {shoppingPlanCycleId && activeProfiles.length === 0 ? (
          <p className="muted">Crea al menos un perfil activo para calcular cobertura diaria.</p>
        ) : null}

        <div className="coverage-grid">
          {dailyCoverageRows.map((row) => {
            const complements = getComplements(row.balance)
            const deficits = nutrientMeta
              .filter((meta) => (row.balance?.[meta.key] || 0) > 0)
              .map((meta) => {
                const value = row.balance?.[meta.key] || 0
                return `${meta.label}: +${value.toFixed(meta.key === 'kcal' ? 0 : 1)}${meta.unit}`
              })
            const excesses = nutrientMeta
              .filter((meta) => (row.balance?.[meta.key] || 0) < 0)
              .map((meta) => {
                const value = Math.abs(row.balance?.[meta.key] || 0)
                return `${meta.label}: -${value.toFixed(meta.key === 'kcal' ? 0 : 1)}${meta.unit}`
              })
            return (
              <article className="coverage-card" key={row.dayIso}>
                <div className="list-top">
                  <h3>
                    {row.dayLabel} {row.dayIso}
                  </h3>
                  <span className={`pill coverage-pill coverage-${row.status}`}>
                    {Number.isFinite(row.coveragePercent) ? `${row.coveragePercent.toFixed(0)}% kcal` : '-'}
                  </span>
                </div>

                <p className="muted compact">
                  {row.slotDetails.length === 0
                    ? 'Sin comidas planificadas este dia.'
                    : row.slotDetails.map((slot) => `${slot.label}: ${slot.recipeName}`).join(' | ')}
                </p>
                <div className="nutrient-grid">
                  {nutrientMeta.map((meta) => {
                    const target = row.targetDaily?.[meta.key] || 0
                    const consumed = row.consumed?.[meta.key] || 0
                    const balance = row.balance?.[meta.key] || 0
                    const state = nutrientStatus(consumed, target)
                    const balanceLabel =
                      balance > 0
                        ? `Falta ${balance.toFixed(meta.key === 'kcal' ? 0 : 1)}${meta.unit}`
                        : balance < 0
                          ? `Exceso ${Math.abs(balance).toFixed(meta.key === 'kcal' ? 0 : 1)}${meta.unit}`
                          : 'En objetivo'
                    return (
                      <div key={meta.key} className={`nutrient-box nutrient-${state}`}>
                        <p className="nutrient-name">{meta.label}</p>
                        <p className="nutrient-main">
                          {consumed.toFixed(meta.key === 'kcal' ? 0 : 1)}
                          {meta.unit} / {target.toFixed(meta.key === 'kcal' ? 0 : 1)}
                          {meta.unit}
                        </p>
                        <p className="nutrient-balance">{balanceLabel}</p>
                      </div>
                    )
                  })}
                </div>

                <p className="muted compact">
                  Faltante del día: {deficits.length > 0 ? deficits.join(' | ') : 'Sin faltantes.'}
                </p>
                <p className="muted compact">
                  Exceso del día: {excesses.length > 0 ? excesses.join(' | ') : 'Sin excesos.'}
                </p>
                <p className="muted compact">
                  Complementar: {complements.length > 0 ? complements.join(' | ') : 'Objetivo diario cubierto o excedido.'}
                </p>
              </article>
            )
          })}
        </div>
      </section>
    )
  }

  if (!session) {
    return (
      <main className="page page-auth">
        <section className="card">
          <h1>Meal Planner</h1>
          <p className="muted">Login with your Supabase account.</p>

          <form onSubmit={handleSignIn} className="form">
            <label>
              Email
              <input
                type="email"
                name="email"
                value={authForm.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                name="password"
                value={authForm.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </label>

            {authError ? <p className="error">{authError}</p> : null}

            <button type="submit" disabled={authLoading}>
              {authLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="page page-app">
      <section className="card app-card">
        <header className="header-row">
          <div>
            <h1>Meal Planner</h1>
            <p className="muted">Logged in as {userEmail}</p>
          </div>
          <button type="button" onClick={handleSignOut} className="button-secondary">
            Sign out
          </button>
        </header>

        <nav className="tab-row">
          <datalist id="ingredient-base-options">
            {ingredientCatalog.map((item) => (
              <option key={item.id} value={item.ingredient_base} />
            ))}
          </datalist>
          <button
            type="button"
            className={activeView === 'recipes' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('recipes')}
          >
            Recetas
          </button>
          <button
            type="button"
            className={activeView === 'catalog' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('catalog')}
          >
            Parametrización
          </button>
          <button
            type="button"
            className={activeView === 'planner' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('planner')}
          >
            Plan 4 semanas
          </button>
          <button
            type="button"
            className={activeView === 'shopping' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('shopping')}
          >
            Compra semanal
          </button>
          <button
            type="button"
            className={activeView === 'saved-plans' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('saved-plans')}
          >
            Planes guardados
          </button>
          <button
            type="button"
            className={activeView === 'profiles' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('profiles')}
          >
            Perfiles
          </button>
          <button
            type="button"
            className={activeView === 'daily-coverage' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('daily-coverage')}
          >
            Cobertura diaria
          </button>
        </nav>

        {activeView === 'recipes' ? renderRecipesView() : null}
        {activeView === 'catalog' ? renderCatalogView() : null}
        {activeView === 'planner' ? renderPlannerView() : null}
        {activeView === 'shopping' ? renderShoppingView() : null}
        {activeView === 'saved-plans' ? renderSavedPlansView() : null}
        {activeView === 'profiles' ? renderProfilesView() : null}
        {activeView === 'daily-coverage' ? renderDailyCoverageView() : null}
      </section>
    </main>
  )
}

export default App
