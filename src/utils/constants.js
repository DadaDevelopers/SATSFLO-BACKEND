/**
 * Application Constants
 *
 * Centralized constants for consistent use across the application
 * Frontend should mirror these values for validation
 */

module.exports = {
  // User roles
  USER_ROLES: {
    USER: 'user',
    ADMIN: 'admin',
    MODERATOR: 'moderator',
  },

  // Cycle phases based on menstrual cycle
  CYCLE_PHASES: {
    MENSTRUAL: 'menstrual', // Days 1-5: Period
    FOLLICULAR: 'follicular', // Days 6-14: Pre-ovulation
    OVULATION: 'ovulation', // Days 14-16: Fertile window
    LUTEAL: 'luteal', // Days 17-28: Post-ovulation
  },

  // Flow intensity levels
  FLOW_INTENSITY: {
    SPOTTING: 'spotting',
    LIGHT: 'light',
    MEDIUM: 'medium',
    HEAVY: 'heavy',
    VERY_HEAVY: 'very_heavy',
  },

  // Mood types for tracking
  MOOD_TYPES: {
    NORMAL: 'normal',
    HAPPY: 'happy',
    SAD: 'sad',
    CALM: 'calm',
    HYPED: 'hyped',
    IN_LOVE: 'in_love',
    PEACEFUL: 'peaceful',
    ANGRY: 'angry',
    LONELY: 'lonely',
    SILLY: 'silly',
    RELAXED: 'relaxed',
    IRRITABLE: 'irritable',
    ANXIOUS: 'anxious',
    ENERGETIC: 'energetic',
    TIRED: 'tired',
    STRESSED: 'stressed',
    EMOTIONAL: 'emotional',
    CONFIDENT: 'confident',
  },

  // Symptom categories
  SYMPTOM_CATEGORIES: {
    PHYSICAL: 'physical',
    EMOTIONAL: 'emotional',
    PAIN: 'pain',
    DIGESTIVE: 'digestive',
    SKIN: 'skin',
    SLEEP: 'sleep',
  },

  // Common symptoms list
  SYMPTOMS: {
    // Pain
    CRAMPS: 'cramps',
    HEADACHE: 'headache',
    BACKACHE: 'backache',
    BREAST_TENDERNESS: 'breast_tenderness',
    JOINT_PAIN: 'joint_pain',

    // Physical
    BLOATING: 'bloating',
    FATIGUE: 'fatigue',
    NAUSEA: 'nausea',
    DIZZINESS: 'dizziness',
    HOT_FLASHES: 'hot_flashes',

    // Digestive
    CONSTIPATION: 'constipation',
    DIARRHEA: 'diarrhea',
    APPETITE_CHANGES: 'appetite_changes',
    CRAVINGS: 'cravings',

    // Skin
    ACNE: 'acne',
    OILY_SKIN: 'oily_skin',
    DRY_SKIN: 'dry_skin',

    // Sleep
    INSOMNIA: 'insomnia',
    OVERSLEEPING: 'oversleeping',

    // Other
    WATER_RETENTION: 'water_retention',
    WEIGHT_FLUCTUATION: 'weight_fluctuation',

    // Log-screen symptom aliases
    BELLY_ACHE: 'belly_ache',
    SORE_BREASTS: 'sore_breasts',
  },

  // Medicine / contraception options
  MEDICINE_TYPES: {
    CONDOM: 'condom',
    PATCH: 'patch',
    INJECTION: 'injection',
    SPERMICIDE: 'spermicide',
    IUD: 'iud',
    PILL: 'pill',
    IMPLANT: 'implant',
    VAGINAL_RING: 'vaginal_ring',
  },

  // Symptom severity levels
  SEVERITY_LEVELS: {
    MILD: 1,
    MODERATE: 2,
    SEVERE: 3,
  },

  // Privacy settings
  PRIVACY_LEVELS: {
    PRIVATE: 'private',
    FRIENDS: 'friends',
    PUBLIC: 'public',
  },

  // Token types
  TOKEN_TYPES: {
    VERIFICATION: 'verification',
    PASSWORD_RESET: 'password_reset',
    REFRESH: 'refresh',
  },

  // Verification methods
  VERIFICATION_METHODS: {
    EMAIL: 'email',
    PHONE: 'phone',
  },

  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },

  // Cycle defaults
  CYCLE_DEFAULTS: {
    AVERAGE_CYCLE_LENGTH: 28,
    AVERAGE_PERIOD_LENGTH: 5,
    MIN_CYCLE_LENGTH: 21,
    MAX_CYCLE_LENGTH: 35,
  },

  // Password requirements
  PASSWORD_REQUIREMENTS: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: false,
  },

  // File upload limits
  FILE_LIMITS: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  },

  // Account status
  ACCOUNT_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
    DELETED: 'deleted',
  },
};
