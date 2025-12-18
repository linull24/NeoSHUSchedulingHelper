export const enUS = {
  settings: {
    title: 'Display Settings',
    subtitle: 'Switch dock theme and global preferences.',
    displaySection: 'Display',
    behaviorSection: 'Behavior',
    pwaSection: 'App (PWA)',
    theme: 'Theme',
    themeColorLabel: 'Theme color (MD3)',
    themeColorDesc: 'Applies to Material Design 3 only.',
    fluentAccentColorLabel: 'Accent color (Fluent)',
    fluentAccentColorDesc: 'Applies to Fluent 2 only.',
    collapseLabel: 'Course collapse mode',
    collapseDesc: 'Decide whether course lists collapse by course group.',
    collapseOn: 'Collapse by group',
    collapseOff: 'Show each section',
    hideFilterStatusLabel: 'Filters: hide status control',
    hideFilterStatusDesc: 'When enabled, the course filter toolbar hides the “Status” control (the current status mode still applies).',
    hideFilterStatusOn: 'Hide status control',
    hideFilterStatusOff: 'Show status control',
    crossCampusLabel: 'Allow cross-campus courses',
    crossCampusDesc: 'Enable to show campus and cross-campus details on course cards.',
    crossCampusOn: 'Show campus',
    crossCampusOff: 'Hide campus',
    homeCampusLabel: 'Home campus',
    homeCampusDesc: 'Your primary campus, used for default filtering and hints.',
    homeCampusUnset: 'Not set',
    modeLabel: 'Selection mode (term)',
    modeDesc: 'Choose Allow Overflow Mode or Overflow Speed Race Mode; can be changed anytime.',
    allowOverflowMode: 'Allow Overflow Mode (overbook)',
    overflowSpeedRaceMode: 'Overflow Speed Race Mode',
    paginationLabel: 'Pagination mode',
    paginationDesc: 'Choose paged or continuous loading for course lists (All Courses, Wishlist, Selected, JWXT).',
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
      auto: 'Auto (system/plugin)',
      zh: '简体中文',
      en: 'English'
    },
    pwaInstallStateLabel: 'Installable web app',
    pwaInstallStateDesc: 'Install this site as an app (PWA) for a standalone window.',
    pwaInstalledYes: 'Installed (standalone)',
    pwaInstalledNo: 'Not installed (browser tab)',
    pwaInstallHint:
      'If the Install button is disabled, use your browser menu: “Install app” / “Add to Home Screen”.',
    pwaOfflineStateLabel: 'Offline capability',
    pwaOfflineStateDesc: 'Shows service worker status (basic asset caching when supported).',
    pwaSwUnsupported: 'Unsupported (service worker unavailable)',
    pwaSwDevDisabled: 'Disabled in dev mode (use build + preview)',
    pwaSwRegistered: 'Enabled (registered)',
    pwaSwControlled: 'Enabled (controlling this page)',
    pwaSwNotRegistered: 'Not enabled (registration failed or blocked)',
    pwaInstallActionLabel: 'Install action',
    pwaInstallActionDesc: 'Available in supported browsers when install criteria are met.',
    pwaInstallButton: 'Install app',
    pwaInstallDismissed: 'Install dismissed',
    pwaInstallFailed: 'Install failed',
    aboutSection: 'About',
    aboutDesc: 'Project links and feedback channels.',
    aboutProductLabel: 'Product',
    aboutProductDesc: 'Homepage and project information.',
    aboutOpenHomepage: 'Open homepage',
    aboutProjectGroup: 'Project',
    aboutFeedbackGroup: 'Feedback',
    aboutGithubRepo: 'GitHub repository',
    aboutGithubIssues: 'GitHub issues',
    aboutTencentSupport: 'Tencent support'
  },
  meta: {
    productName: 'SHU Scheduling Helper',
    productByline: 'by SHUOSC',
    productIconAlt: 'SHUOSC logo'
  },
  common: {
    dockTitle: 'Course Tools',
    settings: 'Settings',
    optional: 'Optional',
    selectPlaceholder: 'Select an option',
    crawlStages: {
      context: 'Loading selection context…',
      list: 'Fetching course list…',
      details: 'Fetching course details…',
      finalize: 'Finalizing snapshot…',
      download: 'Downloading cloud snapshot…',
      error: 'Error'
    }
  },
  dialogs: {
    autoSolve: {
      title: 'Auto plan',
      description:
        'Plans at group granularity: keeps selected groups and tries to satisfy wishlisted group targets (no section-level actions). Applies the plan to Selected.',
      enabledLabel: 'Auto mode',
      enabledOn: 'Enabled',
      enabledOff: 'Disabled',
      selectionModeLabel: 'Selection mode',
      selectionModeUnknown: 'Not set',
      disabledSpeedRace: 'Auto mode is disabled in speed-race mode.',
      timeSoftTitle: 'Time soft constraints (weight, 0 disables)',
      avoidEarly: 'Avoid early (period 1-2)',
      avoidLate: 'Avoid late (period 11+)',
      timeSoftHint: 'Only affects auto plan; manual solver is unchanged.',
      groupCountLabel: 'Wishlisted groups',
      groupCountValue: '{count}',
      runNow: 'Run auto plan',
      runningButton: 'Running…',
      running: 'Running auto plan…',
      done: 'Auto plan applied.',
      failed: 'Auto plan failed.',
      noGroups: 'No wishlisted targets and no selected groups to plan.',
      openSolver: 'Open solver',
      close: 'Close'
    },
    autoSolveExit: {
      title: 'Exit auto mode',
      summary:
        'A manual snapshot was saved before entering auto mode (Selected {selected}, wishlisted sections {wishlistSections}, wishlisted groups {wishlistGroups}). Restore it?',
      hint: '“Restore & exit” overwrites current state. “Exit only” keeps the current state.',
      cancel: 'Cancel',
      keep: 'Exit only',
      restore: 'Restore & exit'
    },
    autoSolveExitFailed: {
      title: 'Cannot exit auto mode',
      summary: 'Failed to export to a section-level solution (unsat or solver error). Auto mode stays enabled.',
      errorLabel: 'Reason:',
      ack: 'OK'
    },
    datasetResolve: {
      title: 'Course grouping changed',
      summary:
        'Course grouping candidates changed. Removed {wishlist} wishlist groups and {staging} solver groups that can no longer be resolved. Fatal count: {fatal} / 2.',
      downgraded: 'Granularity was automatically downgraded to section-only mode.',
      hint: 'Try “Refresh dataset and retry” first. If it persists, switch to section-only. Check Action Log for details.',
      reload: 'Refresh dataset and retry',
      switchSectionOnly: 'Switch to section-only',
      ack: 'Continue'
    },
    solverInvalid: {
      title: 'Invalid constraints',
      summary: 'Found {count} invalid constraints. Fix them or delete them automatically.',
      lockLabel: 'Lock {id}',
      softLabel: 'Soft constraint {id}',
      reasons: {
        'lock.courseHashMissing': 'Missing courseHash.',
        'lock.courseHashNotFound': 'courseHash not found in dataset.',
        'lock.sectionIdMissing': 'Missing sectionId.',
        'lock.sectionNotFound': 'Section not found in dataset.',
        'lock.teacherIdMissing': 'Missing teacherId.',
        'lock.teacherNotFound': 'Teacher not found in dataset.',
        'lock.timeWindowMissing': 'Missing time window.',
        'lock.timeWindowRange': 'Invalid time range (start >= end).',
        'lock.groupEmpty': 'Empty group candidate list.',
        'lock.groupAllMissing': 'All group candidates are missing in dataset.',
        'soft.weightInvalid': 'Invalid weight (must be > 0).',
        'soft.campusMissing': 'Missing campus parameter.',
        'soft.groupKeyMissing': 'Missing groupKey.',
        'soft.groupKeyNotFound': 'Group not found in dataset.',
        'soft.sectionIdMissing': 'Missing sectionId.',
        'soft.sectionNotFound': 'Section not found in dataset.'
      },
      close: 'Close',
      autoDelete: 'Delete invalid constraints'
    },
    selectionClear: {
      title: 'Clearing wishlist will break solver constraints',
      summary: 'Clearing wishlist will invalidate {count} solver locks.',
      hint: 'Continue will delete those locks and clear wishlist.',
      cancel: 'Cancel',
      confirm: 'Delete locks and clear wishlist'
    },
    groupPick: {
      title: 'Select a section',
      hint: 'Group selection must be resolved to a specific section before enrolling or syncing.',
      cancel: 'Cancel',
      confirm: 'Select'
    }
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
      loadErrorTitle: 'Workspace failed to load',
      loadErrorHint: 'Refresh the page or inspect the console for details.',
      narrowMessage: 'Viewport is narrow, so the workspace switches to the tabbed layout for reliability.',
      fallbackTabsAria: 'Fallback workspace panels',
      compactSelectLabel: 'Choose panel'
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
		      conflictListSeparator: '; ',
		      autoSolve: {
		        toggle: 'Auto mode',
		        settings: 'Auto plan settings'
		      },
			      availability: {
			        requiresReselect: 'May require reselecting existing courses.',
			        policyBlocksReselect: 'Blocked by list policy (requires reschedule).',
			        impossible: 'Unavailable due to conflicts with selected courses.',
			        groupNoSelectable: 'No selectable sections in this group.'
			      }
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
      },
      bulk: {
        label: '{count} selected',
        actions: {
          wishlistAdd: 'Add to wishlist',
          wishlistRemove: 'Remove from wishlist'
        },
        selectAll: 'Select all',
        selectPage: 'Select this page',
        clearSelection: 'Clear selection',
        execute: 'Apply',
        working: 'Working…',
        selectGroup: 'Select group {name}',
        selectSection: 'Select section {name}',
        done: 'Applied {applied} items (skipped {skipped}).',
        nothing: 'Nothing to apply (skipped {skipped}).'
      }
    },
    candidates: {
      title: 'Wishlist',
      description: 'Pick courses to keep in the wishlist or remove them anytime.',
      autoTitle: 'Course selection',
      autoDescription: 'Filter course groups and mark them as auto-plan targets.',
      empty: 'Wishlist is empty',
      clear: 'Clear',
      expand: 'More',
      collapse: 'Collapse',
      select: 'Select',
      unselect: 'Unselect',
      autoTargetAdd: 'Add target',
      autoTargetRemove: 'Remove target',
      autoTargetBlocked: 'No feasible plan under current policy.',
      removeGroup: 'Remove from wishlist',
      groupTotal: '{count} sections',
      bulk: {
        label: '{count} selected',
        actions: {
          select: 'Select',
          remove: 'Remove',
          importSolver: 'Import to solver'
        },
        selectAll: 'Select all',
        selectPage: 'Select this page',
        clearSelection: 'Clear selection',
        execute: 'Apply',
        working: 'Working…',
        selectGroup: 'Select group {name}',
        selectSection: 'Select section {name}',
        autoTargetResult: 'Added {added} targets, skipped {skipped} infeasible groups.',
        groupSelectUnsupported: '{count} group items require choosing a specific section. Use the per-group action instead.'
      },
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
      drop: 'Drop',
      bulk: {
        label: '{count} selected',
        actions: {
          demote: 'Move to wishlist',
          importSolver: 'Import to solver'
        },
        selectAll: 'Select all',
        selectPage: 'Select this page',
        clearSelection: 'Clear selection',
        execute: 'Apply',
        working: 'Working…',
        selectGroup: 'Select group {name}',
        selectSection: 'Select section {name}'
      }
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
      undoApply: 'Undo apply',
      stagingTitle: 'Staging',
      stagingHint: 'Imported items will appear here.',
      stagingEmpty: 'No staging items yet.',
      stagingRemove: 'Remove',
      stagingClear: 'Clear staging',
      staging: {
        lockSection: 'Lock section',
        lockGroup: 'Lock group'
      },
      quickAddTitle: 'Quick add',
      quickAdd: {
        time: 'Add time constraint',
        teacher: 'Add teacher constraint',
        soft: 'Add soft constraint'
      },
      timeDialog: {
        applyAllDays: 'Apply to all weekdays'
      },
      bulk: {
        selected: '{count} selected',
        apply: 'Apply',
        remove: 'Remove',
        clear: 'Clear'
      },
      cardOps: {
        button: 'Actions',
        title: 'Actions',
        applyToSection: 'Apply to section',
        applyToGroup: 'Apply to group',
        convertToGroup: 'Convert to group',
        convertToSection: 'Convert to section',
        expandSections: 'Expand sections',
        removeFromStaging: 'Remove from staging',
        weightLabel: 'Weight'
      },
      groupExpand: {
        title: 'Group sections',
        hint: 'Pick a section and apply desire/avoid.'
      },
      groupAllowed: {
        title: 'Allowed sections',
        modeLabel: 'Mode',
        modeRequireAvoid: 'Hard: require group + soft avoid sections',
        modeLimitAllowed: 'Hard: limit allowed sections',
        sectionDirectionLabel: 'Section direction',
        sectionStrengthLabel: 'Section strength',
        hintLimitAllowed: 'Pick which sections are allowed for this group lock (solver will choose among them).',
        hintRequireAvoid: 'Pick which sections to avoid (solver will try to avoid them, but may still pick if needed).',
        count: '{count} allowed',
        avoidCount: '{count} avoided',
        selectedCount: '{count} selected',
        selectAll: 'Select all',
        clearAll: 'Clear',
        avoidAll: 'Avoid all',
        clearAvoid: 'Clear avoids',
        avoidWeightLabel: 'Avoid weight',
        cancel: 'Cancel',
        confirm: 'Apply',
        emptyError: 'Select at least one allowed section.',
        missingGroup: 'Cannot resolve the course group for this item.',
        edit: 'Edit allowed sections',
      },
      groupPick: {
        title: 'Pick a section',
        hint: 'Select one section from this group to lock.',
        cancel: 'Cancel',
        confirm: 'Lock section',
        missingSection: 'Selected section is missing in dataset.'
      },
      timePreset: 'Time presets{label}',
      timePresetOptions: ['Period 1', 'Periods 11-12', 'Morning', 'Afternoon', 'Evening'],
      templateNamePlaceholder: 'Template name',
      templateValuePlaceholder: 'Time expression or note',
      templateNameAria: 'Time template name',
      templateValueAria: 'Time template value',
      saveTemplate: 'Save template',
      deleteTemplate: 'Delete',
      timeExpressionLabel: 'Time expression',
      timeExpressionDesc: 'Custom soft-constraint note/expression (current version does not parse it into executable rules).',
      timeExpressionToolsShow: 'Show templates & help',
      timeExpressionToolsHide: 'Hide templates & help',
      timeExpressionSaved: 'Saved templates',
      timeExpressionHelpTitle: 'Time expression tips',
      timeExpressionHelpLine1: 'You can enter plain notes; recommended format: weekday + period range (e.g., Mon 1-2).',
      timeExpressionHelpLine2: 'Presets/templates only fill the input; after submit it is stored as the soft-constraint description.',
      timeExpressionHelpLine3: 'For executable time rules, extend solver semantics later (traits reserved).',
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
      lockTeacherLabel: 'Teacher',
      lockTeacherPlaceholder: 'Teacher name or ID',
      teacherResolveError: 'Cannot resolve teacher. Please pick from suggestions.',
      teacherResolved: 'Resolved: {label}',
      lockWeekday: 'Weekday',
      lockStartPeriod: 'Start period',
      lockEndPeriod: 'End period',
      lockNote: 'Note',
      lockTimeLabel: 'Time {weekday} {range}',
      lockSectionLabel: 'Section {id}',
      lockGroupLabel: 'Group ({count} courses)',
      lockTypeOptions: {
        course: 'Course',
        section: 'Section',
        teacher: 'Teacher',
        time: 'Time window',
        group: 'Group'
      },
      addLock: 'Add hard constraint',
      softLocks: 'Soft constraints',
      softCount: '{count} items',
      softTypeOptions: {
        'avoid-early': 'Avoid early classes',
        'avoid-late': 'Avoid late classes',
        'avoid-campus': 'Avoid campus',
        'avoid-group': 'Avoid group',
        'avoid-section': 'Avoid section',
        'prefer-group': 'Prefer group',
        'prefer-section': 'Prefer section',
        'limit-consecutive': 'Limit back-to-back classes',
        'max-per-day': 'Limit classes per day',
        custom: 'Custom'
      },
      softDescriptions: {
        'avoid-early': 'Avoid early classes',
        'avoid-late': 'Avoid late classes',
        'avoid-campus': 'Avoid campus {campus}',
        'avoid-group': 'Avoid group {label}',
        'avoid-section': 'Avoid section {label}',
        'prefer-group': 'Prefer group {label}',
        'prefer-section': 'Prefer section {label}',
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
      unsatHint: 'No solution under hard constraints.',
      unsatSoftHint: 'Try switching some hard constraints to soft, or revert conflicting states to None.',
      unsatDiagnosticsTitle: 'Diagnostics',
      unsatCoreTitle: 'Unsat core',
      unsatTitle: 'No solution',
      unsatConflictLabel: 'Non-adjustable conflict',
      diagnosticAdjustable: 'Adjustable conflict',
      diagnosticUnadjustable: 'Non-adjustable conflict',
      diagnosticSoft: 'Soft constraint unmet',
      softDiagnosticsTitle: 'Soft constraints unmet',
      softDiagnosticsReason: 'Soft constraint not satisfied',
      planAdd: 'Add {label}',
      planRemove: 'Remove {label}',
      planAddOverride: 'Add manual override',
      planRemoveOverride: 'Remove manual override'
      ,
      solutionSummary: 'Solution sections: {count}',
      solutionEmpty: 'No sections in this solution.',
      weekdayFallback: 'Day {index}',
      periodSingle: 'P{index}',
      periodRange: 'P{start}-{end}',
      groupConstraintsTitle: 'Group constraints',
      groupConstraintsHint: 'Review the currently applied constraints per group.',
      groupConstraintsEmpty: 'No group constraints yet.',
      pendingTitle: 'Staged',
      pendingHint: 'Use course list bulk action “Import to solver” to stage groups/sections, then set hard/soft states here and apply.',
      pendingEmpty: 'No staged items.',
      pendingApplyRequiresExplicit: 'Set at least one non-default hard/soft state before applying.',
      pendingConflictHardSoft: 'Hard/soft cannot both be set for the same section. Keep one side as None.',
      statusBox: {
        level: {
          hard: 'Hard',
          soft: 'Soft'
        },
        state: {
          require: 'Pick',
          forbid: 'Forbid',
          none: 'None'
        },
        tag: {
          active: 'Applied',
          pending: 'Staged'
        },
        conflict: 'Conflict'
      }
    },
    actionLog: {
      title: 'Action Log',
      description: 'Track constraint edits and solver runs; roll back supported entries.',
      empty: 'No log entries yet.',
      rollback: 'Rollback',
      undo: 'Undo',
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
    jwxt: {
      title: 'JWXT',
      description: 'Log in to JWXT to sync and plan enrollment; pushes show a diff and require confirmation.',
      subtitle: 'Real JWXT integration (login required)',
      connectionTitle: 'Connection & Login',
      connectionDescription:
        'Log in to JWXT to sync selected courses, or push your local selection state to JWXT.',
      crawlData: 'Crawl data',
      crawlHint: 'After crawling, reload the page to apply the new dataset.',
      rounds: {
        title: 'Term & Round',
        roundLabel: 'Enrollment round',
        roundIndex: 'Round {count}',
        refresh: 'Refresh rounds',
        loading: 'Loading rounds...',
        cloudCompareLoading: 'Comparing cloud rounds...',
        cloudCompareOk: 'Cloud rounds aligned',
        cloudCompareFailed: 'Cloud round compare failed: {error}',
        cloudCompareMismatch: 'Cloud rounds mismatch: missing {missing}; mismatched {mismatched}'
      },
      refresh: 'Refresh',
      ping: 'Test connection',
      login: 'Log in',
      logout: 'Log out',
      loginHint: 'Your password is only sent to the local backend. You can optionally save an encrypted session cookie for auto login.',
      loginMethodLabel: 'Login method',
      loginMethodPassword: 'Password',
      loginMethodCookie: 'Cookie',
      userIdLabel: 'Student ID',
      passwordLabel: 'Password',
      cookieHeaderLabel: 'Cookie (header)',
      importCookie: 'Import cookie',
      cookieHint: 'Paste a Cookie header captured from JWXT (e.g. via browser devtools).',
      persistHint: 'Auto login (optional): save a JWXT session cookie locally.',
      persistNone: 'Do not save',
      persistDevice: 'Save for auto login (device)',
      persistVault: 'Encrypt with password (requires unlock)',
      persistVaultHint: 'Password vault requires interaction (unlock) for login.',
      persistSaveNow: 'Save current session',
      vaultPasswordLabel: 'Vault password',
      vaultPasswordConfirmLabel: 'Confirm vault password',
      vaultUnlockPasswordLabel: 'Vault password',
      vaultUnlockHint: 'A password-encrypted cookie vault exists. Unlock to log in.',
      vaultUnlockAndLogin: 'Unlock & log in',
      vaultClear: 'Clear vault',
      deviceVaultHint: 'Auto-login cookie is saved on this device.',
      deviceVaultClear: 'Clear auto-login',
      syncTitle: 'Sync',
      syncDescription: 'Pull selection state from JWXT, or push local state to JWXT.',
      syncFrom: 'Sync from JWXT',
      pushTo: 'Push to JWXT',
      ttlLabel: 'Confirm-time check (TTL)',
      ttl0: '0 (re-check before every confirm, recommended)',
      ttl120: '120s (skip checks for 120 seconds)',
      autoSync: 'Auto sync (pull only)',
      autoSyncInterval: 'Interval',
      autoPush: 'Auto push (confirmation required)',
      autoPushHint: 'Auto push is enabled: selection changes will trigger a diff confirmation dialog.',
      autoPushMutedUntil: 'Auto push reminders muted until {time}',
      localCounts: 'Local state: {selected} selected, {wishlist} wishlist',
      lastSyncAt: 'Last sync: {time}',
      lastPushAt: 'Last push: {time}',
      confirmHint: 'Any action that may modify JWXT always shows a confirmation dialog.',
      enrollTitle: 'Enroll (direct)',
      enrollDescription:
        'Use the same filter toolbar as All Courses to filter local courses, then submit a direct enrollment request to JWXT (login required).',
      bulk: {
        label: '{count} selected',
        selectVisible: 'Select this page',
        selectEligible: 'Select all',
        selectAll: 'Select all',
        clearSelection: 'Clear selection',
        enrollExecute: 'Batch enroll',
        dropExecute: 'Batch drop',
        working: 'Working…',
        selectEnroll: 'Select to enroll: {name}',
        selectDrop: 'Select to drop: {name}',
        selectDropNoMapping: 'Select to drop: {kchId} ({jxbId})'
      },
      searchLabel: 'Search',
      searchPlaceholder: 'Course code / name / instructor',
      search: 'Search',
      enroll: 'Enroll now',
      drop: 'Drop',
      dropNow: 'Drop now',
      copyToWishlist: 'Copy to wishlist',
      planSelect: 'Plan select',
      planDeselect: 'Unselect',
      planWishlistAdd: 'Add to wishlist',
      planWishlistRemove: 'Remove from wishlist',
      planDrop: 'Plan drop',
      planUnavailable: 'Unavailable',
      planUnavailableHint: 'Not found in local dataset (reference only)',
      remoteSelectedTitle: 'JWXT Selected',
      remoteSelectedDescription: 'Selected courses from JWXT (plan drops and push later).',
      remoteSelectedNoMapping: 'Not found in local dataset',
      confirm: {
        cancel: 'Cancel',
        close: 'Close',
        autoPushTitle: 'Selection changed (auto push)',
        autoPushBody: 'This will apply: enroll {enroll}, drop {drop}. Continue?',
        mute2m: 'Mute reminders for 2 minutes (auto-confirm)',
        pushTitle: 'Confirm pushing to JWXT',
        pushBody:
          'This will try to push your local selection state to JWXT: {selected} selected, {wishlist} wishlist. Continue?',
        pushPreviewBody: 'This will apply: enroll {enroll}, drop {drop}. Continue?',
        remoteChangedBody: 'JWXT changed since your last preview. Diff has been recalculated; please confirm again.',
        pushConfirm: 'Push to JWXT',
        pushDiffEnrollTitle: 'To enroll',
        pushDiffDropTitle: 'To drop',
        pushDiffEmpty: 'No changes',
        pushDiffMore: '…and {count} more',
        bulkEnrollTitle: 'Confirm batch enrollment',
        bulkEnrollBody: 'This will submit {count} enrollment request(s) to JWXT. {skipped} will be skipped. Continue?',
        bulkEnrollConfirm: 'Batch enroll',
        bulkEnrollListTitle: 'To enroll',
        bulkDropTitle: 'Confirm batch dropping',
        bulkDropBody: 'This will submit {count} drop request(s) to JWXT. Continue?',
        bulkDropConfirm: 'Batch drop',
        bulkDropListTitle: 'To drop',
        bulkSkipTitle: 'Skipped',
        bulkSkipCount: 'Skipped {count} item(s) (time conflict/already selected/unavailable)',
        enrollTitle: 'Confirm enrollment',
        enrollBody:
          'This will submit an enrollment request to JWXT: {course}. It may change your enrollment results. Continue?',
        enrollConfirm: 'Enroll',
        dropTitle: 'Confirm dropping',
        dropBody:
          'This will submit a drop request to JWXT: {course}. It may affect your schedule and credits. Continue?',
        dropConfirm: 'Drop'
      },
      statuses: {
        loading: 'Loading JWXT status...',
        backendMissing: 'DUE to COTS,temperary unavailable.',
        loggedIn: 'Logged in to JWXT.',
        loggedOut: 'Not logged in to JWXT.',
        roundSelected: 'Enrollment round switched: {round}',
        roundSnapshotActivated: 'Cached snapshot activated (refresh to apply): {round}',
        accountLabel: 'Account: {userId}',
        statusFailed: 'Failed to load status: {error}',
        crawling: 'Crawling course data...',
        crawlProgress: 'Crawled {done}/{total} courses',
        crawlSuccess: 'Crawl succeeded. Reload the page to apply the new dataset.',
        crawlFailed: 'Crawl failed: {error}',
        pinging: 'Testing connection...',
        pingOk: 'Connection test done (HTTP {status})',
        pingFailed: 'Connection test failed: {error}',
        missingCredentials: 'Enter your student ID and password first',
        missingUserId: 'Enter your student ID first',
        missingCookieCredentials: 'Enter your student ID and cookie first',
        missingVaultPassword: 'Enter vault password first',
        loggingIn: 'Logging in...',
        importingCookie: 'Importing cookie...',
        loginSuccess: 'Login succeeded',
        loginFailed: 'Login failed: {error}',
        logoutFailed: 'Logout failed: {error}',
        autoLoginTrying: 'Trying auto login...',
        autoLoginSuccess: 'Auto login succeeded',
        autoLoginFailed: 'Auto login failed: {error}',
        requireLogin: 'Log in to JWXT first',
        syncing: 'Syncing...',
        syncSuccess: 'Sync succeeded: {selected} selected, {wishlist} wishlist',
        syncFailed: 'Sync failed: {error}',
        pushing: 'Pushing...',
        pushSuccess: 'Push request sent',
        pushFailed: 'Push failed: {error}',
        pushSummary: 'Push result: enrolled {enroll}, dropped {drop}',
        pushDetails: 'Details: {count} ops',
        searching: 'Searching...',
        searchEmpty: 'Enter a search query first',
        searchFailed: 'Search failed: {error}',
        searchSuccess: 'Search finished: {count} results',
        enrollSuccess: 'Enrollment request submitted',
        bulkNothingToEnroll: 'Nothing eligible to batch enroll (skipped time conflicts/already selected).',
        bulkEnrollSuccess: 'Submitted {count} enrollment request(s)',
        copyToWishlistSuccess: 'Copied to wishlist',
        dropSuccess: 'Drop request submitted',
        bulkNothingToDrop: 'Nothing selected to batch drop.',
        bulkDropSuccess: 'Submitted {count} drop request(s)',
        vaultPasswordTooShort: 'Vault password must be at least 6 characters',
        vaultPasswordMismatch: 'Vault passwords do not match',
        persistSaved: 'Saved session for future login',
        persistFailed: 'Failed to save session: {error}'
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
      storageFilterStatusControl: 'Hide filter status control: {value}',
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
      importReplaceButton: 'Import & replace from Gist',
      githubMissing: 'GitHub Client ID missing; cannot start login.',
      confirm: {
        importTitle: 'Confirm import & replace',
        importBody: 'This will download term-state.base64 from Gist {gistId} and overwrite your local TermState. This cannot be undone. Continue?',
        cancel: 'Cancel',
        importConfirm: 'Import'
      },
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
        termStateMissing: 'TermState not loaded yet. Please retry.',
        syncing: 'Building snapshot and syncing...',
        syncSuccess: 'Sync success: {url}',
        syncFailed: 'Sync failed: {error}',
        syncDone: 'Sync completed',
        gistIdRequired: 'Enter a Gist ID',
        gistImporting: 'Importing & replacing from Gist...',
        gistImportSuccess: 'Import succeeded: local TermState replaced',
        gistImportDone: 'Import completed'
      }
    }
  },
  filters: {
    view: 'View',
    search: 'Search',
    searchPlaceholder: 'Course name / code / instructor',
    searchHelp:
      'Supports: course name / course code / instructor / note. Split multiple terms with spaces or punctuation (AND). Optional prefixes: teacher: / code: / name: / note:.',
    status: 'Status',
	    conflict: 'Conflict mode',
	    sort: 'Sort',
	    sortOrderAsc: 'Ascending',
	    sortOrderDesc: 'Descending',
		    showConflictBadges: 'Show conflict items',
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
    statusModes: {
      all: {
        none: 'No filter',
        noStatus: 'No status',
        wishlist: 'Wishlist',
        selected: 'Selected',
        orphanSelected: 'Orphan selected'
      },
      wishlist: {
        none: 'No filter',
        orphan: 'Orphan wishlist',
        hasSelected: 'Wishlist: group selected'
      },
      selected: {
        none: 'No filter',
        orphan: 'Orphan selected',
        hasWishlist: 'Selected: group has wishlist'
      }
    },
    conflictOptions: {
      any: 'No filter',
      noAnyConflict: 'No conflicts',
      noTimeConflict: 'No time conflicts',
      currentImpossible: 'Currently not selectable',
      hardTimeConflict: 'Hard constraint: time conflict',
      hardImpossible: 'Hard constraint: not selectable',
      softTimeConflict: 'Soft constraint: adjustable',
      softImpossible: 'Soft constraint: not selectable'
    },
    conflictJudgeOptions: {
      off: 'Disable conflict judging',
      time: 'Time conflict',
      current: 'Currently not selectable',
      hard: 'Hard constraint: not selectable',
      soft: 'Soft constraint: not selectable'
    },
    campus: 'Campus',
    campusLockedHint: 'Campus filter is locked. Enable “Allow cross-campus” in Settings first.',
    college: 'College',
    major: 'Major',
    specialFilter: 'Sports',
    specialTagsLabel: 'Special tags (dynamic)',
    specialFilterOptions: {
      all: 'No filter',
      sportsOnly: 'Sports only',
      excludeSports: 'Exclude sports'
    },
    creditRange: 'Credit range',
    minPlaceholder: 'Min',
    maxPlaceholder: 'Max',
    capacityMin: 'Capacity minimum',
    languageMode: 'Language / exceptions',
    noLimit: 'No limit',
    teachingLanguageLabel: 'Language',
    teachingModeLabel: 'Exceptions',
    modeOtherPlaceholder: 'Other mode (text contains)',
    abnormalFilterOptions: {
      defaultHidden: 'Hide by default (recommended)',
      showAll: 'Show all (including exceptions)',
      onlyAbnormal: 'Only exceptions',
      mixed: 'Mixed'
    },
    abnormalFilterSummaries: {
      defaultHidden: 'Exceptions hidden by default',
      showAll: 'Showing all courses (including exceptions)',
      onlyAbnormal: 'Only exception courses',
      mixed: 'Exception filter is in a mixed state'
    },
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
    first: 'First',
    prev: 'Previous',
    next: 'Next',
    last: 'Last',
    jump: 'Jump',
    totalPages: '{count} pages'
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
	    teacherLabel: 'Teacher',
	    campusLabel: 'Campus',
	    teacherPending: 'Teacher TBD',
	    timeLabel: 'Time',
	    infoLabel: 'Info',
	    courseCodeLabel: 'Course code',
	    courseCodePending: 'Code pending',
    creditLabel: 'Credit',
    creditValue: '{value} credits',
    creditPending: 'Credit pending',
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
    desire: 'Desire',
    avoid: 'Avoid',
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
  setupWizard: {
    title: 'Setup',
    progress: 'Step {current}/{total}',
    termLabel: 'Term: {term}',
    language: {
      body: 'Choose interface language.',
      hint: 'Auto follows your system language (and can be overridden by plugins/injections). You can change this anytime in Settings.',
      options: {
        auto: 'Auto',
        zh: '简体中文',
        en: 'English'
      }
    },
    actions: {
      back: 'Back',
      next: 'Next',
      finish: 'Finish',
      close: 'Close'
    },
    welcome: {
      body: 'You can use cloud course data as a fallback without logging in. Logging in to JWXT is optional.',
      hint: 'If you log in, you can sync your selected courses and run enrollment actions (where supported).'
    },
    selectionMode: {
      body: 'Please choose the enrollment mode for this term.',
      allowOverflow: 'Allow Overflow',
      speedRace: 'Speed Race',
      hint: 'You can change this later in Settings.'
    },
    homeCampus: {
      body: 'Choose your home campus.',
      label: 'Home campus',
      hint: 'Home campus is used as the default filter. If cross-campus is disabled, the campus filter will be locked.',
      noOptions: 'No campus options are available in the current dataset. Please log in and crawl/fetch a snapshot, then reload the page and try again.',
      unset: 'Not set'
    },
    login: {
      body: 'Login to JWXT (optional). You can also skip this step and continue using cloud data only.',
      methods: {
        password: 'Password',
        cookie: 'Cookie'
      },
      status: {
        loggedIn: 'Logged in'
      },
      userId: 'Student ID',
      password: 'Password',
      cookieWarning: 'Only paste cookies you trust. Cookies may grant account access. Never share them.',
      cookieHeader: 'Cookie header',
      persistCookie: 'Encrypt and save cookie locally (WebCrypto)',
      vaultPassword: 'Local vault password',
      vaultPasswordConfirm: 'Confirm vault password',
      unlockHint: 'If you have a saved cookie vault, unlock it to import the cookie again.',
      actions: {
        login: 'Login',
        check: 'Check status',
        importCookie: 'Import cookie',
        unlockAndImport: 'Unlock & import'
      },
      errors: {
        missingCredentials: 'Please enter student ID and password.',
        missingCookie: 'Please paste a cookie header.',
        vaultPasswordTooShort: 'Vault password is too short (min 6 chars).',
        vaultPasswordMismatch: 'Vault passwords do not match.',
        missingVaultPassword: 'Please enter vault password.',
        loginFailed: 'Login failed. Please check your credentials.'
      }
    },
    cloud: {
      body: 'Fetch course data for the current term (recommended once).',
      hint: 'If JWXT backend is available and you are logged in, it will crawl live data; otherwise it falls back to cloud snapshots.',
      reloadHint: 'If crawling succeeds, reload the page to apply the new dataset.',
      actions: {
        fetch: 'Crawl data'
      },
      status: {
        cached: 'Cached locally',
        ok: 'Crawl succeeded',
        progress: 'Progress: {done}/{total}',
        roundSnapshotActivated: 'Cached round snapshot activated (refresh to apply).',
        failed: 'Crawl failed'
      }
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
      materialDesc: 'mdui runtime tokens (Material Design 3) via Virtual Theme Layer.',
      fluentDesc: 'Fluent UI runtime tokens via Virtual Theme Layer.'
    },
    limitRules: {
      capacityFull: 'Capacity full',
      capacityFullDesc: 'Control whether to show full courses',
      selectionForbidden: 'Selection forbidden',
      selectionForbiddenDesc: 'Exclude or only show courses with selection restrictions',
      dropForbidden: 'Drop forbidden',
      dropForbiddenDesc: 'Exclude or only show courses with drop restrictions',
      locationClosed: 'Location unavailable',
      locationClosedDesc: 'Exclude or only show courses with closed/unavailable locations',
      classClosed: 'Class closed',
      classClosedDesc: 'Exclude or only show closed/suspended classes',
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
    timeConflict: 'Time conflict: {overlaps}',
    sameGroupSelected: 'Same group already selected'
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
