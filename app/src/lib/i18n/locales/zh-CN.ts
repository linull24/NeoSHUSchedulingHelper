export const zhCN = {
  settings: {
    title: '界面设置',
    subtitle: '切换 Dock 主题 / 全局配置。',
    theme: '主题',
    collapseLabel: '课程折叠视图',
    collapseDesc: '控制“全部课程”等面板是否按课程名折叠显示。',
    collapseOn: '按课程折叠',
    collapseOff: '逐条显示',
    crossCampusLabel: '允许跨校区',
    crossCampusDesc: '开启后课程卡片将显示校区信息。',
    crossCampusOn: '显示校区',
    crossCampusOff: '隐藏校区',
    modeLabel: '选课模式（本学期）',
    modeDesc: '可超额 / 拼手速选择，可随时修改。',
    allowOverflowMode: '可超额',
    overflowSpeedRaceMode: '拼手速',
    paginationLabel: '分页模式',
    paginationDesc: '选择分页或连续滚动，应用于全部课程列表。',
    paged: '分页',
    continuous: '连续',
    pageSize: '页大小',
    pageNeighbors: '邻近页数',
    weekendLabel: '日历显示周末',
    weekendDesc: '默认隐藏周六日，如有周末课程或需展示可开启。',
    weekendOn: '显示周末',
    weekendOff: '隐藏周末',
    languageLabel: '界面语言',
    languageDesc: '切换 UI 语言，立刻生效。',
    languageOptions: {
      zh: '简体中文',
      en: 'English'
    }
  },
  common: {
    dockTitle: '课程工具',
    settings: '设置',
    optional: '可选',
    selectPlaceholder: '请选择'
  },
  lists: {
    countLabel: '共 {count} 项',
    pinFilters: '锁定筛选区',
    unpinFilters: '取消锁定'
  },
  layout: {
    dockDescription: 'Dockview 工作区承载所有面板，并在窄屏时自动切换备用布局。',
    tabs: {
      allCourses: '全部课程',
      wishlist: '待选课程',
      selected: '已选课程',
      solver: '求解器',
      actionLog: '操作日志',
      sync: '导入/导出',
      settings: '设置'
    },
    workspace: {
      loadErrorTitle: '无法加载 Dock 布局',
      loadErrorHint: '刷新页面或查看控制台详细信息。',
      fallbackMessage: 'Dock 布局加载失败，请刷新页面。',
      modeDock: 'Dock 布局',
      modeFallback: '标签布局',
      toggleToDock: '切换到 Dock 布局',
      toggleToFallback: '切换到标签布局',
      toggleReset: '清除偏好',
      narrowMessage: '屏幕宽度不足，已切换到标签布局以保证可用性。',
      manualFallbackHint: '当前处于标签布局，可随时切回 Dock 布局。',
      fallbackTabsAria: '备用工作区面板列表',
      compactSelectLabel: '选择要查看的面板',
      reason: {
        auto: '自动（屏宽不足）',
        error: 'Dock 暂不可用',
        user: '手动切换'
      }
    }
  },
  calendar: {
    title: '课程表',
    description: '传统课表样式，左侧为时间，横向按周一至周五排列。',
    slotPrefix: '第',
    slotSuffix: '节',
    emptyTitle: '无课程选中',
    emptyHint: '移动到待选/全部列表或操作面板查看课程详情。',
    weekdaysShort: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  },
  panels: {
    common: {
      conflictHard: '硬冲突',
      conflictTime: '时间冲突',
      conflictDivider: ' · ',
      conflictListSeparator: '；'
    },
    allCourses: {
      title: '全部课程',
      description: '展示所有候选课程，可快速加入待选。',
      empty: '暂无课程',
      variantCountLabel: '{count} 个班次',
      expandHint: '展开/收起课程组',
      addGroup: '加入待选',
      removeGroup: '取消待选',
      stateLabels: {
        selected: '已选',
        wishlist: '已在待选',
        add: '加入待选'
      }
    },
    candidates: {
      title: '待选课程',
      description: '从这里选择或移除待选的课程。',
      empty: '暂无待选课程',
      clear: '清空',
      expand: '更多',
      collapse: '收起',
      select: '选课',
      removeGroup: '取消待选',
      groupTotal: '共 {count} 班次',
      toggleMore: {
        expand: '更多',
        collapse: '收起'
      }
    },
    selected: {
      title: '已选课程',
      description: '查看并管理已经选定的课程。',
      empty: '暂无已选课程',
      reselect: '重选',
      drop: '退课'
    },
    solver: {
      title: '求解器',
      description: '配置硬/软约束并执行求解。',
      intro: '先整理硬/软约束，再运行求解器，建议操作和诊断会在下方展示。',
      run: '运行求解器',
      solving: '求解中…',
      direction: '方向',
      priority: '优先级',
      selectedCount: '已选 {count}',
      cancel: '取消',
      apply: '添加',
      timePreset: '时间预设{label}',
      timePresetOptions: ['第1节', '11-12', '上午', '下午', '晚间'],
      templateNamePlaceholder: '模板名称',
      templateValuePlaceholder: '时间表达式或备注',
      templateNameAria: '时间模板名称',
      templateValueAria: '时间模板内容',
      saveTemplate: '保存模板',
      deleteTemplate: '删除',
      pendingNotice: '已选中课程尚未添加约束，请先添加为硬/软约束再求解。',
      addAndContinue: '添加并继续',
      ignore: '忽略',
      constraintsNotReady: '尚未加载约束设置',
      unknownError: '求解过程中发生未知错误',
      hardLocks: '硬约束 / 锁',
      loadingLocks: '正在加载锁列表...',
      loadingSoft: '正在加载软约束...',
      lockType: '类型',
      lockPriority: '优先级',
      lockCourseLabel: '课程',
      lockTeacherLabel: '教师号',
      lockTeacherPlaceholder: '教师编号',
      lockWeekday: '星期',
      lockStartPeriod: '开始节次',
      lockEndPeriod: '结束节次',
      lockNote: '备注',
      lockTimeLabel: '时间 {weekday} {range}',
      lockSectionLabel: '班次 {id}',
      lockGroupLabel: '组合 ({count} 门)',
      lockTypeOptions: {
        course: '课程',
        teacher: '教师',
        time: '时间段'
      },
      addLock: '添加硬约束',
      softLocks: '软约束',
      softCount: '{count} 条',
      softTypeOptions: {
        'avoid-early': '避免早课',
        'avoid-late': '避免晚课',
        'avoid-campus': '避免校区',
        'limit-consecutive': '限制连续课',
        'max-per-day': '限制每日课数',
        custom: '自定义'
      },
      softDescriptions: {
        'avoid-early': '避免早课',
        'avoid-late': '避免晚课',
        'avoid-campus': '避免校区 {campus}',
        'limit-consecutive': '限制连续课程',
        'max-per-day': '限制每日课程数',
        custom: '自定义'
      },
      softCampusLabel: '校区',
      softCampusPlaceholder: '请选择校区',
      searchConstraints: '搜索约束',
      constraintType: '类型',
      constraintTypeLabels: {
        group: '组',
        section: '班次',
        time: '时间',
        course: '课程',
        teacher: '教师',
        custom: '自定义'
      },
      constraintPriority: '优先级',
      constraintDirection: '方向',
      constraintStatus: '状态',
      constraintSource: '来源',
      constraintEmpty: '暂无约束',
      tagIncludeCount: '包含 {count}',
      tagExcludeCount: '排除 {count}',
      requiredGroupTag: '必选组',
      excludedGroupTag: '排除组',
      quickType: '类型',
      quickWeight: '权重',
      quickNote: '备注',
      addSoft: '添加软约束',
      convertToHard: '转为硬约束',
      convertToSoft: '转为软约束',
      removeConstraint: '移除',
      solverResultTitle: '求解结果',
      solverResultHint: '点击“运行求解器”获取方案。',
      solverResultSolving: '求解中，请稍候...',
      solverResultStatusLabel: '状态：',
      solverResultStatusFeasible: '可行',
      solverResultStatusInfeasible: '无解',
      solverResultMetricsVariables: '变量',
      solverResultMetricsHard: '硬约束',
      solverResultMetricsSoft: '软约束',
      solverResultMetricsElapsed: '耗时',
      solverPlanTitle: '建议操作 ({count})',
      solverPlanEmpty: '无操作，当前选择已满足约束。',
      unsatTitle: '无解',
      unsatConflictLabel: '不可调冲突',
      diagnosticAdjustable: '可调冲突',
      diagnosticUnadjustable: '不可调冲突',
      softDiagnosticsTitle: '软约束未满足',
      softDiagnosticsReason: '未满足软约束',
      planAdd: '添加 {label}',
      planRemove: '移除 {label}',
      planAddOverride: '新增排课调整',
      planRemoveOverride: '移除排课调整'
    },
    actionLog: {
      title: '操作日志',
      description: '记录约束修改与求解行为，可对部分记录进行回滚。',
      empty: '尚无日志记录。',
      rollback: '回滚',
      rollbackFailure: '回滚失败',
      selectionRestored: '已恢复选课：已选 {selected} 门，待选 {wishlist} 门',
      errors: {
        rollback: '回滚失败'
      },
      targets: {
        selected: '已选列表',
        wishlist: '待选列表',
        unknown: '列表'
      },
      scope: {
        hard: '硬约束',
        soft: '软约束'
      },
      change: {
        add: '新增',
        remove: '删除'
      },
      solverStatus: {
        sat: 'SAT',
        unsat: 'UNSAT',
        unknown: '未知'
      },
      override: {
        merge: '合并',
        'replace-all': '全部替换'
      },
      describe: {
        solverRun: '求解（{status}），计划 {plan} 条',
        solverPreview: '预览求解计划（{plan} 条），目标 {target}',
        solverApply: '应用求解计划（{plan} 条）到 {target}',
        solverOverride: '覆写求解计划（{plan} 条），目标 {target}（{mode}）',
        solverUndo: '撤销求解结果并恢复 {target}',
        rollback: '回滚 {scope}'
      },
      selection: {
        select: '已选 {course}',
        deselect: '退选 {course}',
        moveToWishlist: '移回待选：{course}',
        wishlistAdd: '加入待选：{course}',
        wishlistRemove: '从待选移除：{course}',
        wishlistClear: '清空待选（{count} 门）',
        unknownCourse: '课程'
      }
    },
    sync: {
      title: '导入 / 导出 & 同步',
      currentTerm: '当前学期：{term}',
      storageTitle: '当前设置快照',
      storageDescription: '以下是当前浏览器存储的偏好设置，供参考或调试。',
      storageLanguage: '界面语言：{locale}',
      storageTheme: '主题：{theme}',
      storagePagination: '分页：{mode}，每页 {size} 条，邻近 {neighbors} 页',
      storageSelectionMode: '选课模式：{mode}',
      storageCrossCampus: '跨校区：{value}',
      storageCollapse: '课程折叠：{value}',
      storageTimeTemplates: '时间模板：{count} 个',
      exportTitle: '导出选课状态',
      exportDescription: '生成 Base64 快照（包含学期/版本），方便复制或贴到 Issue/Gist。',
      exportPlaceholder: '点击下方按钮生成 Base64',
      exportButton: '生成 Base64',
      copyButton: '复制',
      importTitle: '导入选课状态',
      importDescription: '粘贴 Base64 快照，恢复“已选 / 待选”列表。',
      importPlaceholder: '粘贴 Base64 字符串',
      importButton: '导入 Base64',
      gistTitle: '同步到 GitHub Gist',
      gistDescription: '打包愿望/选课/操作日志等状态，上传到私有 Gist 作为云备份。',
      loginGithub: '登录 GitHub',
      logoutGithub: '退出',
      gistLoggedIn: '已登录 GitHub',
      gistIdLabel: 'Gist ID（可选）',
      gistIdPlaceholder: '已存在的 Gist ID，用于增量更新',
      noteLabel: '备注 / Note',
      notePlaceholder: '描述此次同步，如 2025 春测试',
      publicLabel: '公开 Gist（默认私有）',
      uploadButton: '上传到 Gist',
      githubMissing: '未配置 GitHub Client ID，无法发起 GitHub 登录。',
      statuses: {
        generated: '已生成 Base64 快照，可复制保存或贴到 Issue/Gist。',
        exportFailed: '导出失败：{error}',
        copySuccess: '已复制到剪贴板',
        copyFailed: '复制失败，请手动复制',
        importEmpty: '请输入 Base64 快照内容',
        importSuccess: '导入成功：已选 {selected} 条，待选 {wishlist} 条',
        importIgnored: '，忽略 {count} 条',
        importFailed: '导入失败：{error}',
        githubLoginSuccess: 'GitHub 登录成功',
        requireLogin: '请先登录 GitHub',
        syncing: '正在生成快照并同步...',
        syncSuccess: '同步成功：{url}',
        syncFailed: '同步失败：{error}'
      }
    }
  },
  filters: {
    view: '视图',
    search: '搜索',
    searchPlaceholder: '课程名 / 课程号 / 教师号',
    status: '状态',
    conflict: '冲突',
    sort: '排序',
    regex: '正则',
    caseSensitive: '大小写',
    advanced: '高级筛选',
    closeAdvanced: '关闭高级',
    jump: '跳转',
    totalPages: '共 {count} 页',
    viewModes: {
      all: '全部',
      wishlist: '待选',
      selected: '已选'
    },
    displayOptions: {
      all: '显示全部',
      wishlistPending: '只显示未待选',
      wishlistSelected: '只显示已待选',
      selectedPending: '只显示未选',
      selectedChosen: '只显示已选'
    },
    conflictOptions: {
      any: '不限',
      noAnyConflict: '无任何冲突',
      noTimeConflict: '无时间冲突',
      noHardConstraintConflict: '无硬约束冲突',
      noUnavoidableConflict: '无可避免冲突'
    },
    campus: '校区',
    college: '学院',
    major: '专业',
    specialFilter: '特殊课程',
    specialFilterOptions: {
      all: '不过滤',
      sportsOnly: '仅体育',
      excludeSports: '排除体育'
    },
    creditRange: '学分区间',
    minPlaceholder: '最小',
    maxPlaceholder: '最大',
    capacityMin: '容量下限',
    languageMode: '教学语言/模式',
    noLimit: '不限',
    teachingLanguageLabel: '教学语言',
    teachingModeLabel: '教学模式',
    modeOtherPlaceholder: '其他教学模式（文本包含）',
    weekFilters: '周次筛选',
    weekParityLabel: '单双周',
    weekSpanLabel: '上/下半',
    weekParityOptions: {
      any: '不筛',
      odd: '单周',
      even: '双周',
      all: '全部周'
    },
    weekSpanOptions: {
      any: '不筛',
      upper: '前半',
      lower: '后半',
      full: '全学期'
    },
    weekParitySummary: {
      any: '周次不限',
      odd: '单周',
      even: '双周',
      all: '全周'
    },
    weekSpanSummary: {
      any: '半学期不限',
      upper: '前半',
      lower: '后半',
      full: '全学期'
    },
    listSeparator: '，'
  },
  pagination: {
    prev: '上一页',
    next: '下一页'
  },
  courseCard: {
    markSelection: '标记必选/排除',
    includeShort: '必',
    excludeShort: '排',
    noneShort: '□',
    conflict: '冲突',
    conflictNone: '暂无冲突数据',
    statusLimited: '余量紧张',
    statusFull: '已满',
    teacherPending: '教师待定',
    timeLabel: '时间',
    infoLabel: '信息',
    noTime: '暂无时间',
    locationPending: '待排教室'
  },
  searchBar: {
    placeholder: '搜索课程或教师',
    clear: '清空搜索'
  },
  dropdowns: {
    include: '包含',
    exclude: '排除',
    hard: '硬约束',
    soft: '软约束',
    enabled: '启用',
    disabled: '禁用',
    listSource: '列表按钮',
    solverSource: '求解器',
    importSource: '导入'
  },
  prompts: {
    selectionMode: {
      title: '选择选课模式',
      description: '首次进入本学期，请确认是否允许超额或拼手速。可在设置中随时修改。',
      close: '关闭',
      allowOverflow: '允许超额选课',
      speedRace: '拼手速选课'
    }
  },
  hover: {
    location: '地点',
    termSpan: '学期',
    weekParity: '周次',
    extra: {
      teacher: '教师',
      credit: '学分',
      campus: '校区',
      capacity: '容量'
    }
  },
  config: {
    themes: {
      materialDesc: 'Google 官方 @material/web 控件与 tokens。',
      fluentDesc: '微软 @fluentui/web-components 提供的 fluent 主题。'
    },
    limitRules: {
      capacityFull: '人数已满',
      capacityFullDesc: '限制是否显示已满课程',
      selectionForbidden: '禁止选课',
      selectionForbiddenDesc: '限制是否显示禁止选课的课程',
      vacancyLimited: '余量紧张',
      vacancyLimitedDesc: '标记课程容量状态是否紧张'
    },
    displayOptions: {
      all: '全部',
      unselected: '只显示未待选',
      selected: '只显示已待选'
    },
    sortOptions: {
      courseCode: '课程号',
      credit: '学分',
      remainingCapacity: '容量剩余',
      time: '上课时间',
      teacherName: '教师'
    },
    teachingLanguages: {
      chinese: '中文',
      english: '全英',
      bilingual: '双语',
      unspecified: '未指定'
    },
    weekSpan: {
      upper: '上半学期',
      lower: '下半学期',
      full: '全学期'
    },
    weekParity: {
      odd: '单周',
      even: '双周',
      all: '全部周'
    },
    conflictOptions: {
      noAnyConflict: '无任何冲突',
      noHardConstraintConflict: '无硬冲突',
      noUnavoidableConflict: '排除不可调冲突'
    }
  },
  errors: {
    importEmpty: '请输入 base64 字符串',
    invalidFormat: '快照格式不正确',
    unsupportedSchema: '不支持的快照 schema',
    missingVersion: '缺少快照版本号',
    missingData: '快照缺少 selected / wishlist 数组',
    githubMissingClientId: '缺少 GitHub Client ID，无法发起登录。请设置 PUBLIC_GITHUB_CLIENT_ID',
    githubMissingCode: '缺少 code',
    githubStateValidation: 'state 校验失败',
    githubServerConfig: '服务器未配置 GitHub OAuth 凭据',
    githubTokenExchange: '交换 token 失败：{error}',
    githubLoginFailed: 'GitHub 登录失败：{message}',
    githubNoAccessToken: 'GitHub 未返回 access_token'
  },
  api: {
    loginSuccess: '登录成功，可以关闭此页面。'
  },
  rules: {
    noop: {
      title: '基础巡检',
      description: '默认规则：始终返回 info。',
      message: '规则系统已初始化，可根据需要添加更多规则。'
    }
  },
  conflict: {
    hardConflict: '硬冲突：{targets}',
    timeConflict: '时间冲突：{overlaps}'
  },
  courseCatalog: {
    weekdays: {
      monday: '周一',
      tuesday: '周二',
      wednesday: '周三',
      thursday: '周四',
      friday: '周五',
      saturday: '周六',
      sunday: '周日'
    },
    teacherUnassigned: '教师待定',
    remaining: '剩余',
    capacityLabel: '容量',
    sectionId: '班次',
    courseFull: '已满'
  }
};
