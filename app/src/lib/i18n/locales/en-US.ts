export const enUS = {
  settings: {
    title: 'Display Settings',
    subtitle: 'Switch dock theme and global preferences.',
    theme: 'Theme',
    collapseLabel: 'Course collapse mode',
    collapseDesc: 'Decide whether course lists collapse by course name.',
    collapseOn: 'Collapse by course',
    collapseOff: 'Show each section',
    crossCampusLabel: 'Allow cross-campus courses',
    crossCampusDesc: 'Enable to show campus and cross-campus details on course cards.',
    crossCampusOn: 'Show campus',
    crossCampusOff: 'Hide campus',
    modeLabel: 'Selection mode (term)',
    modeDesc: 'Choose Allow Overflow Mode or Overflow Speed Race Mode; can be changed anytime.',
    allowOverflowMode: 'Allow Overflow Mode (overbook)',
    overflowSpeedRaceMode: 'Overflow Speed Race Mode',
    paginationLabel: 'Pagination mode',
    paginationDesc: 'Choose paged or continuous loading for course lists.',
    paged: 'Paged',
    continuous: 'Continuous',
    pageSize: 'Page size',
    pageNeighbors: 'Neighbor page count',
    weekendLabel: 'Show weekends in calendar',
    weekendDesc: 'Hidden by default; enable if weekend classes exist.',
    weekendOn: 'Show weekends',
    weekendOff: 'Hide weekends',
    languageLabel: 'Interface language',
    languageDesc: 'Switch UI language instantly.',
    languageOptions: {
      zh: '简体中文',
      en: 'English'
    }
  },
  common: {
    dockTitle: 'Course Tools',
    settings: 'Settings',
    optional: 'Optional',
    selectPlaceholder: 'Select an option'
  },
  lists: {
    countLabel: '{count} items',
    pinFilters: 'Pin filters',
    unpinFilters: 'Unpin filters'
  },
  layout: {
    dockDescription: 'Dockview workspace hosting every panel with responsive fallback.',
    tabs: {
      allCourses: 'All Courses',
      wishlist: 'Wishlist',
      selected: 'Selected',
      solver: 'Solver',
      actionLog: 'Action Log',
      sync: 'Import/Export',
      settings: 'Settings'
    },
    workspace: {
      loadErrorTitle: 'Unable to load dock layout',
      loadErrorHint: 'Refresh the page or inspect the console for details.',
      fallbackMessage: 'Dock layout failed to load. Please refresh.',
      modeDock: 'Dock layout',
      modeFallback: 'Tabbed layout',
      toggleToDock: 'Switch to dock layout',
      toggleToFallback: 'Switch to tabbed layout',
      toggleReset: 'Reset preference',
      narrowMessage: 'Viewport is narrow, so the workspace switched to the tabbed layout for reliability.',
      manualFallbackHint: 'Tabbed layout is active. Use the button above to return to the dock layout at any time.',
      fallbackTabsAria: 'Fallback workspace panels',
      compactSelectLabel: 'Choose panel',
      reason: {
        auto: 'Auto (narrow width)',
        error: 'Dock unavailable',
        user: 'Manual override'
      }
    }
  },
  calendar: {
    title: 'Course Calendar',
    description: 'Classic timetable layout; time on the left, Monday through Sunday across.',
    slotPrefix: 'Period ',
    slotSuffix: ' ',
    emptyTitle: 'No course selected',
    emptyHint: 'Hover items in the lists or solver panel to view course details.',
    weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  },
  panels: {
    common: {
      conflictHard: 'Hard conflict',
      conflictTime: 'Time conflict',
      conflictDivider: ' · ',
      conflictListSeparator: '; '
    },
    allCourses: {
      title: 'All Courses',
      description: 'Browse every candidate course; quickly add items to wishlist.',
      empty: 'No courses available',
      variantCountLabel: '{count} sections',
      expandHint: 'Expand/collapse group',
      addGroup: 'Add to wishlist',
      removeGroup: 'Remove from wishlist',
      stateLabels: {
        selected: 'Selected',
        wishlist: 'In wishlist',
        add: 'Add to wishlist'
      }
    },
    candidates: {
      title: 'Wishlist',
      description: 'Pick courses to keep in the wishlist or remove them anytime.',
      empty: 'Wishlist is empty',
      clear: 'Clear',
      expand: 'More',
      collapse: 'Collapse',
      select: 'Select',
      removeGroup: 'Remove from wishlist',
      groupTotal: '{count} sections',
      toggleMore: {
        expand: 'More',
        collapse: 'Collapse'
      }
    },
    selected: {
      title: 'Selected Courses',
      description: 'Review and manage courses already selected.',
      empty: 'No selected courses',
      reselect: 'Reselect',
      drop: 'Drop'
    },
    solver: {
      title: 'Solver',
      description: 'Configure hard/soft constraints and run the solver.',
      intro: 'Add hard/soft constraints, then run the solver to review suggested actions below.',
      run: 'Run solver',
      solving: 'Solving…',
      direction: 'Direction',
      priority: 'Priority',
      selectedCount: '{count} selected',
      cancel: 'Cancel',
      apply: 'Apply',
      timePreset: 'Time presets{label}',
      timePresetOptions: ['Period 1', 'Periods 11-12', 'Morning', 'Afternoon', 'Evening'],
      templateNamePlaceholder: 'Template name',
      templateValuePlaceholder: 'Time expression or note',
      templateNameAria: 'Time template name',
      templateValueAria: 'Time template value',
      saveTemplate: 'Save template',
      deleteTemplate: 'Delete',
      pendingNotice: 'Selected courses need constraints before solving. Add hard/soft constraints first.',
      addAndContinue: 'Add & continue',
      ignore: 'Ignore',
      constraintsNotReady: 'Constraints not loaded yet',
      unknownError: 'An unknown error occurred while solving.',
      hardLocks: 'Hard constraints / locks',
      loadingLocks: 'Loading locks...',
      loadingSoft: 'Loading soft constraints...',
      lockType: 'Type',
      lockPriority: 'Priority',
      lockCourseLabel: 'Course',
      lockTeacherLabel: 'Teacher ID',
      lockTeacherPlaceholder: 'Teacher identifier',
      lockWeekday: 'Weekday',
      lockStartPeriod: 'Start period',
      lockEndPeriod: 'End period',
      lockNote: 'Note',
      lockTimeLabel: 'Time {weekday} {range}',
      lockSectionLabel: 'Section {id}',
      lockGroupLabel: 'Group ({count} courses)',
      lockTypeOptions: {
        course: 'Course',
        teacher: 'Teacher',
        time: 'Time window'
      },
      addLock: 'Add hard constraint',
      softLocks: 'Soft constraints',
      softCount: '{count} items',
      softTypeOptions: {
        'avoid-early': 'Avoid early classes',
        'avoid-late': 'Avoid late classes',
        'avoid-campus': 'Avoid campus',
        'limit-consecutive': 'Limit back-to-back classes',
        'max-per-day': 'Limit classes per day',
        custom: 'Custom'
      },
      softDescriptions: {
        'avoid-early': 'Avoid early classes',
        'avoid-late': 'Avoid late classes',
        'avoid-campus': 'Avoid campus {campus}',
        'limit-consecutive': 'Limit consecutive classes',
        'max-per-day': 'Limit classes per day',
        custom: 'Custom'
      },
      softCampusLabel: 'Campus',
      softCampusPlaceholder: 'Select campus',
      searchConstraints: 'Search constraints',
      constraintType: 'Type',
      constraintTypeLabels: {
        group: 'Group',
        section: 'Section',
        time: 'Time',
        course: 'Course',
        teacher: 'Teacher',
        custom: 'Custom'
      },
      constraintPriority: 'Priority',
      constraintDirection: 'Direction',
      constraintStatus: 'Status',
      constraintSource: 'Source',
      constraintEmpty: 'No constraints',
      tagIncludeCount: 'Include {count}',
      tagExcludeCount: 'Exclude {count}',
      requiredGroupTag: 'Required group',
      excludedGroupTag: 'Excluded group',
      quickType: 'Type',
      quickWeight: 'Weight',
      quickNote: 'Note',
      addSoft: 'Add soft constraint',
      convertToHard: 'Convert to hard constraint',
      convertToSoft: 'Convert to soft constraint',
      removeConstraint: 'Remove',
      solverResultTitle: 'Solver result',
      solverResultHint: 'Click “Run solver” to generate a plan.',
      solverResultSolving: 'Solving, please wait...',
      solverResultStatusLabel: 'Status:',
      solverResultStatusFeasible: 'Feasible',
      solverResultStatusInfeasible: 'No solution',
      solverResultMetricsVariables: 'Variables',
      solverResultMetricsHard: 'Hard constraints',
      solverResultMetricsSoft: 'Soft constraints',
      solverResultMetricsElapsed: 'Elapsed',
      solverPlanTitle: 'Suggested actions ({count})',
      solverPlanEmpty: 'No actions needed; current selection already satisfies constraints.',
      unsatTitle: 'No solution',
      unsatConflictLabel: 'Non-adjustable conflict',
      diagnosticAdjustable: 'Adjustable conflict',
      diagnosticUnadjustable: 'Non-adjustable conflict',
      softDiagnosticsTitle: 'Soft constraints unmet',
      softDiagnosticsReason: 'Soft constraint not satisfied',
      planAdd: 'Add {label}',
      planRemove: 'Remove {label}',
      planAddOverride: 'Add manual override',
      planRemoveOverride: 'Remove manual override'
    },
    actionLog: {
      title: 'Action Log',
      description: 'Track constraint edits and solver runs; roll back supported entries.',
      empty: 'No log entries yet.',
      rollback: 'Rollback',
      rollbackFailure: 'Rollback failed',
      selectionRestored: 'Selection restored: {selected} selected, {wishlist} wishlist',
      errors: {
        rollback: 'Rollback failed'
      },
      targets: {
        selected: 'selected list',
        wishlist: 'wishlist',
        unknown: 'lists'
      },
      scope: {
        hard: 'hard constraints',
        soft: 'soft constraints'
      },
      change: {
        add: 'added',
        remove: 'removed'
      },
      solverStatus: {
        sat: 'SAT',
        unsat: 'UNSAT',
        unknown: 'Unknown'
      },
      override: {
        merge: 'Merge',
        'replace-all': 'Replace all'
      },
      describe: {
        solverRun: 'Solver run ({status}) · {plan} diffs',
        solverPreview: 'Previewed solver plan ({plan}) targeting {target}',
        solverApply: 'Applied solver plan ({plan}) to {target}',
        solverOverride: 'Override solver plan ({plan}) targeting {target} via {mode}',
        solverUndo: 'Undo solver result and restore {target}',
        rollback: 'Rollback {scope}'
      },
      selection: {
        select: 'Selected {course}',
        deselect: 'Dropped {course}',
        moveToWishlist: 'Moved {course} to wishlist',
        wishlistAdd: 'Added {course} to wishlist',
        wishlistRemove: 'Removed {course} from wishlist',
        wishlistClear: 'Cleared wishlist ({count} items)',
        unknownCourse: 'course'
      }
    },
    sync: {
      title: 'Import / Export & Sync',
      currentTerm: 'Current term: {term}',
      storageTitle: 'Current Settings Snapshot',
      storageDescription: 'Below are your browser-stored preferences for reference or debugging.',
      storageLanguage: 'Language: {locale}',
      storageTheme: 'Theme: {theme}',
      storagePagination: 'Pagination: {mode}, {size} per page, {neighbors} neighbors',
      storageSelectionMode: 'Selection mode: {mode}',
      storageCrossCampus: 'Cross-campus: {value}',
      storageCollapse: 'Course collapse: {value}',
      storageTimeTemplates: 'Time templates: {count}',
      exportTitle: 'Export selection state',
      exportDescription: 'Generate a Base64 snapshot (includes term/version) for copying or sharing.',
      exportPlaceholder: 'Click the button below to create Base64',
      exportButton: 'Generate Base64',
      copyButton: 'Copy',
      importTitle: 'Import selection state',
      importDescription: 'Paste a Base64 snapshot to restore selected/wishlist lists.',
      importPlaceholder: 'Paste Base64 string',
      importButton: 'Import Base64',
      gistTitle: 'Sync to GitHub Gist',
      gistDescription: 'Bundle wishlist/selection/log state and upload to a private Gist.',
      loginGithub: 'Log in to GitHub',
      logoutGithub: 'Log out',
      gistLoggedIn: 'GitHub logged in',
      gistIdLabel: 'Gist ID (optional)',
      gistIdPlaceholder: 'Existing Gist ID for incremental updates',
      noteLabel: 'Note',
      notePlaceholder: 'Describe this sync, e.g. Spring 2025 test',
      publicLabel: 'Public Gist (default private)',
      uploadButton: 'Upload to Gist',
      githubMissing: 'GitHub Client ID missing; cannot start login.',
      statuses: {
        generated: 'Base64 snapshot generated. Copy or share as needed.',
        exportFailed: 'Export failed: {error}',
        copySuccess: 'Copied to clipboard',
        copyFailed: 'Copy failed; please copy manually',
        importEmpty: 'Enter the Base64 snapshot first',
        importSuccess: 'Import succeeded: {selected} selected, {wishlist} wishlist',
        importIgnored: ', ignored {count}',
        importFailed: 'Import failed: {error}',
        githubLoginSuccess: 'GitHub login successful',
        requireLogin: 'Log in to GitHub first',
        syncing: 'Building snapshot and syncing...',
        syncSuccess: 'Sync success: {url}',
        syncFailed: 'Sync failed: {error}'
      }
    }
  },
  filters: {
    view: 'View',
    search: 'Search',
    searchPlaceholder: 'Course name / code / instructor',
    status: 'Status',
    conflict: 'Conflict',
    sort: 'Sort',
    regex: 'Regex',
    caseSensitive: 'Case sensitive',
    advanced: 'Advanced filters',
    closeAdvanced: 'Close advanced',
    jump: 'Jump',
    totalPages: '{count} pages total',
    viewModes: {
      all: 'All',
      wishlist: 'Wishlist',
      selected: 'Selected'
    },
    displayOptions: {
      all: 'Show all',
      wishlistPending: 'Only not in wishlist',
      wishlistSelected: 'Only in wishlist',
      selectedPending: 'Only not selected',
      selectedChosen: 'Only selected'
    },
    conflictOptions: {
      any: 'No filter',
      noAnyConflict: 'No conflicts',
      noTimeConflict: 'No time conflicts',
      noHardConstraintConflict: 'No hard constraint violations',
      noUnavoidableConflict: 'No unavoidable conflicts'
    },
    campus: 'Campus',
    college: 'College',
    major: 'Major',
    specialFilter: 'Special courses',
    specialFilterOptions: {
      all: 'No filter',
      sportsOnly: 'Sports only',
      excludeSports: 'Exclude sports'
    },
    creditRange: 'Credit range',
    minPlaceholder: 'Min',
    maxPlaceholder: 'Max',
    capacityMin: 'Capacity minimum',
    languageMode: 'Language / mode',
    noLimit: 'No limit',
    teachingLanguageLabel: 'Language',
    teachingModeLabel: 'Mode',
    modeOtherPlaceholder: 'Other mode (text contains)',
    weekFilters: 'Week filters',
    weekParityLabel: 'Week parity',
    weekSpanLabel: 'Half term',
    weekParityOptions: {
      any: 'No filter',
      odd: 'Odd weeks',
      even: 'Even weeks',
      all: 'All weeks'
    },
    weekSpanOptions: {
      any: 'No filter',
      upper: 'First half',
      lower: 'Second half',
      full: 'Full term'
    },
    weekParitySummary: {
      any: 'Parity unlimited',
      odd: 'Odd weeks',
      even: 'Even weeks',
      all: 'All weeks'
    },
    weekSpanSummary: {
      any: 'Half-term unlimited',
      upper: 'First half',
      lower: 'Second half',
      full: 'Full term'
    },
    listSeparator: ', '
  },
  pagination: {
    prev: 'Previous',
    next: 'Next'
  },
  courseCard: {
    markSelection: 'Mark include/exclude',
    includeShort: 'Inc',
    excludeShort: 'Exc',
    noneShort: '□',
    conflict: 'Conflict',
    conflictNone: 'No conflict data',
    statusLimited: 'Limited seats',
    statusFull: 'Full',
    teacherPending: 'Teacher TBD',
    timeLabel: 'Time',
    infoLabel: 'Info',
    noTime: 'No schedule',
    locationPending: 'Room pending'
  },
  searchBar: {
    placeholder: 'Search course or instructor',
    clear: 'Clear search'
  },
  dropdowns: {
    include: 'Include',
    exclude: 'Exclude',
    hard: 'Hard constraint',
    soft: 'Soft constraint',
    enabled: 'Enabled',
    disabled: 'Disabled',
    listSource: 'List buttons',
    solverSource: 'Solver',
    importSource: 'Import'
  },
  prompts: {
    selectionMode: {
      title: 'Select enrollment mode',
      description: 'On first visit this term, decide whether overflow is allowed or speed mode only. You can change it in Settings.',
      close: 'Close',
      allowOverflow: 'Allow Overflow',
      speedRace: 'Speed Race'
    }
  },
  hover: {
    location: 'Location',
    termSpan: 'Term span',
    weekParity: 'Week pattern',
    extra: {
      teacher: 'Teacher',
      credit: 'Credit',
      campus: 'Campus',
      capacity: 'Capacity'
    }
  },
  config: {
    themes: {
      materialDesc: 'Google official @material/web components and tokens.',
      fluentDesc: 'Microsoft @fluentui/web-components fluent theme.'
    },
    limitRules: {
      capacityFull: 'Capacity full',
      capacityFullDesc: 'Control whether to show full courses',
      selectionForbidden: 'Selection forbidden',
      selectionForbiddenDesc: 'Exclude or only show courses with selection restrictions',
      vacancyLimited: 'Limited seats',
      vacancyLimitedDesc: 'Highlight courses where remaining capacity is tight'
    },
    displayOptions: {
      all: 'All',
      unselected: 'Only not in wishlist',
      selected: 'Only in wishlist'
    },
    sortOptions: {
      courseCode: 'Course code',
      credit: 'Credit',
      remainingCapacity: 'Remaining capacity',
      time: 'Time',
      teacherName: 'Teacher'
    },
    teachingLanguages: {
      chinese: 'Chinese',
      english: 'English',
      bilingual: 'Bilingual',
      unspecified: 'Unspecified'
    },
    weekSpan: {
      upper: 'First half',
      lower: 'Second half',
      full: 'Full term'
    },
    weekParity: {
      odd: 'Odd weeks',
      even: 'Even weeks',
      all: 'All weeks'
    },
    conflictOptions: {
      noAnyConflict: 'No conflicts',
      noHardConstraintConflict: 'No hard conflicts',
      noUnavoidableConflict: 'Exclude unavoidable conflicts'
    }
  },
  errors: {
    importEmpty: 'Please enter base64 string',
    invalidFormat: 'Invalid snapshot format',
    unsupportedSchema: 'Unsupported snapshot schema',
    missingVersion: 'Missing snapshot version',
    missingData: 'Snapshot missing selected / wishlist arrays',
    githubMissingClientId: 'Missing GitHub Client ID. Cannot start login. Please set PUBLIC_GITHUB_CLIENT_ID',
    githubMissingCode: 'Missing code',
    githubStateValidation: 'State validation failed',
    githubServerConfig: 'Server GitHub OAuth credentials not configured',
    githubTokenExchange: 'Token exchange failed: {error}',
    githubLoginFailed: 'GitHub login failed: {message}',
    githubNoAccessToken: 'GitHub did not return access_token'
  },
  api: {
    loginSuccess: 'Login successful. You can close this page.'
  },
  rules: {
    noop: {
      title: 'Basic check',
      description: 'Default rule: always returns info.',
      message: 'Rule system initialized. Add more rules as needed.'
    }
  },
  conflict: {
    hardConflict: 'Hard conflict: {targets}',
    timeConflict: 'Time conflict: {overlaps}'
  },
  courseCatalog: {
    weekdays: {
      monday: 'Mon',
      tuesday: 'Tue',
      wednesday: 'Wed',
      thursday: 'Thu',
      friday: 'Fri',
      saturday: 'Sat',
      sunday: 'Sun'
    },
    teacherUnassigned: 'Teacher TBD',
    remaining: 'Remaining',
    capacityLabel: 'Capacity',
    sectionId: 'Section',
    courseFull: 'Full'
  }
} as const;
