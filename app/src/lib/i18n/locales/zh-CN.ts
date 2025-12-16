export const zhCN = {
  settings: {
    title: '界面设置',
    subtitle: '切换 Dock 主题 / 全局配置。',
    displaySection: '显示',
    behaviorSection: '行为',
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
  dialogs: {
    datasetResolve: {
      title: '课程分组已变化',
      summary: '课程分组候选发生变化。已移除无法解析的课程组：待选 {wishlist} 个，求解器 {staging} 个。fatal 次数：{fatal} / 2。',
      downgraded: '已自动降级为“逐条班次”模式（sectionOnly）。',
      hint: '建议先“在线更新数据集并重试”；若仍异常，可切换为班次模式（sectionOnly）。详情可在“操作日志”查看。',
      reload: '在线更新数据集并重试',
      switchSectionOnly: '切换为班次模式',
      ack: '继续使用'
    },
    solverInvalid: {
      title: '约束无效，无法求解',
      summary: '发现 {count} 条无效约束。请修正后再运行，或自动删除无效约束。',
      lockLabel: '硬约束 {id}',
      softLabel: '软约束 {id}',
      reasons: {
        'lock.courseHashMissing': '缺少 courseHash。',
        'lock.sectionIdMissing': '缺少 sectionId。',
        'lock.teacherIdMissing': '缺少 teacherId。',
        'lock.timeWindowMissing': '缺少时间窗口。',
        'lock.timeWindowRange': '时间范围无效（start >= end）。',
        'lock.groupEmpty': '分组候选为空。',
        'soft.weightInvalid': '权重无效（必须 > 0）。',
        'soft.campusMissing': '缺少校区参数。'
      },
      close: '关闭',
      autoDelete: '自动删除无效约束'
    },
    selectionClear: {
      title: '清空待选将导致求解器约束失效',
      summary: '清空待选会使 {count} 条硬约束失效。',
      hint: '继续将同时删除这些约束并清空待选。',
      cancel: '取消',
      confirm: '删除约束并清空待选'
    },
    groupPick: {
      title: '请选择班次',
      hint: '组选课必须落到具体班次（教务只接受班次）。',
      cancel: '取消',
      confirm: '选择该班次'
    }
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
      loadErrorTitle: '工作区加载失败',
      loadErrorHint: '请刷新页面或查看控制台日志。',
      narrowMessage: '屏幕宽度不足，已暂时切换为标签布局。',
      fallbackTabsAria: '备用工作区面板列表',
      compactSelectLabel: '选择要查看的面板'
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
	      conflictListSeparator: '；',
	      availability: {
	        requiresReselect: '可能需要重选已选课程。',
	        policyBlocksReselect: '当前策略仅允许“无需重排”的课程。',
	        impossible: '与已选课程存在冲突，无法选择。',
	        groupNoSelectable: '该组内暂无可选班次。'
	      }
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
      apply: '应用',
      undoApply: '撤销应用',
      timePreset: '时间预设{label}',
      timePresetOptions: ['第1节', '11-12', '上午', '下午', '晚间'],
      templateNamePlaceholder: '模板名称',
      templateValuePlaceholder: '时间表达式或备注',
      templateNameAria: '时间模板名称',
      templateValueAria: '时间模板内容',
      saveTemplate: '保存模板',
      deleteTemplate: '删除',
      timeExpressionLabel: '时间表达式',
      timeExpressionDesc: '用于自定义软约束的备注/表达式（当前版本不会解析为可计算规则）。',
      timeExpressionToolsShow: '展开时间模板与帮助',
      timeExpressionToolsHide: '收起时间模板与帮助',
      timeExpressionSaved: '已保存模板',
      timeExpressionHelpTitle: '时间表达式提示',
      timeExpressionHelpLine1: '可直接输入备注；建议使用“周几 + 节次范围”的格式（如：周一 1-2）。',
      timeExpressionHelpLine2: '“时间预设/模板”仅用于快速填充输入框，提交后会作为软约束描述保存。',
      timeExpressionHelpLine3: '需要真实可计算的时间规则时，再扩展求解器语义层（traits 已预留）。',
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
      diagnosticSoft: '软约束未满足',
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
      undo: '撤销',
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
    jwxt: {
      title: '教务系统（JWXT）',
      description: '登录教务系统，支持同步与规划选课；推送到教务前会展示 diff 并二次确认。',
      subtitle: '对接真实教务系统（需要登录）',
      connectionTitle: '连接与登录',
      connectionDescription: '登录后可从教务系统同步已选课程，也可将本地选课状态推送到教务系统。',
      refresh: '刷新',
      ping: '测试连接',
      login: '登录',
      logout: '退出登录',
      loginHint: '密码仅发送到本地后端用于登录教务系统，不会在浏览器中持久化保存。',
      userIdLabel: '学号',
      passwordLabel: '密码',
      syncTitle: '同步',
      syncDescription: '从教务系统拉取已选状态，或将本地状态推送到教务系统。',
      syncFrom: '从教务同步',
      pushTo: '推送到教务',
      ttlLabel: '确认前检查（TTL）',
      ttl0: '0（每次确认前重新检查，推荐）',
      ttl120: '120 秒（120s 内跳过检查）',
      autoSync: '自动同步（仅拉取）',
      autoSyncInterval: '间隔',
      autoPush: '自动推送（会弹窗确认）',
      autoPushHint: '已开启自动推送：本地已选发生变化时会自动弹窗提示 diff。',
      autoPushMutedUntil: '自动推送提醒已静默至 {time}',
      localCounts: '本地状态：已选 {selected} 门，待选 {wishlist} 门',
      lastSyncAt: '上次同步：{time}',
      lastPushAt: '上次推送：{time}',
      confirmHint: '任何可能影响教务系统的操作都会弹窗确认。',
      enrollTitle: '搜索 / 选课 / 退课（规划）',
      enrollDescription: '搜索教务课程并映射到本地数据后，可规划已选/待选/退课；最后通过“推送到教务”执行。',
      searchLabel: '搜索',
      searchPlaceholder: '课程号 / 课程名 / 教师号',
      search: '搜索',
      enroll: '选课',
      drop: '退课',
      dropNow: '立即退课',
      planSelect: '规划已选',
      planDeselect: '取消已选',
      planWishlistAdd: '加入待选',
      planWishlistRemove: '移出待选',
      planDrop: '规划退课',
      planUnavailable: '无法规划',
      planUnavailableHint: '未能映射到本地课程数据（仅可作为参考）',
      remoteSelectedTitle: '教务已选',
      remoteSelectedDescription: '来自教务系统的“已选”列表（可规划退课后再推送）。',
      remoteSelectedNoMapping: '未能映射到本地课程数据',
      confirm: {
        cancel: '取消',
        close: '关闭',
        autoPushTitle: '检测到已选变更（自动推送）',
        autoPushBody: '将对教务系统执行：选课 {enroll}，退课 {drop}。确认继续？',
        mute2m: '2 分钟内不再提醒（自动确认）',
        pushTitle: '确认推送到教务系统',
        pushBody: '此操作将尝试把本地选课状态推送到教务系统：已选 {selected} 门，待选 {wishlist} 门。确认继续？',
        pushPreviewBody: '此操作将对教务系统执行：选课 {enroll}，退课 {drop}。确认继续？',
        remoteChangedBody: '教务已变化，已重新计算差异。需要再次确认。',
        pushConfirm: '确认推送',
        pushDiffEnrollTitle: '将选课',
        pushDiffDropTitle: '将退课',
        pushDiffEmpty: '无变更',
        pushDiffMore: '…还有 {count} 条',
        enrollTitle: '确认选课',
        enrollBody: '此操作将向教务系统提交“选课”请求：{course}。可能会占用名额或产生选课结果变化。确认继续？',
        enrollConfirm: '确认选课',
        dropTitle: '确认退课',
        dropBody: '此操作将向教务系统提交“退课”请求：{course}。可能会影响课表与学分。确认继续？',
        dropConfirm: '确认退课'
      },
      statuses: {
        loading: '正在读取教务系统状态...',
        backendMissing: 'JWXT 对接尚未接入（后端未实现）。',
        loggedIn: '已登录教务系统。',
        loggedOut: '未登录教务系统。',
        accountLabel: '帐号：{userId}',
        statusFailed: '状态读取失败：{error}',
        pinging: '正在测试连接...',
        pingOk: '连接测试完成（HTTP {status}）',
        pingFailed: '连接测试失败：{error}',
        missingCredentials: '请输入学号与密码',
        loggingIn: '登录中...',
        loginSuccess: '登录成功',
        loginFailed: '登录失败：{error}',
        logoutFailed: '退出失败：{error}',
        requireLogin: '请先登录教务系统',
        syncing: '同步中...',
        syncSuccess: '同步成功：已选 {selected} 条，待选 {wishlist} 条',
        syncFailed: '同步失败：{error}',
        pushing: '推送中...',
        pushSuccess: '推送请求已发送',
        pushFailed: '推送失败：{error}',
        pushSummary: '推送结果：已选 {enroll}，退课 {drop}',
        pushDetails: '详细结果：{count} 条',
        searching: '搜索中...',
        searchEmpty: '请输入搜索关键词',
        searchFailed: '搜索失败：{error}',
        searchSuccess: '搜索完成：{count} 条结果',
        enrollSuccess: '选课请求已提交',
        dropSuccess: '退课请求已提交'
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
      importReplaceButton: '从 Gist 导入覆盖',
      githubMissing: '未配置 GitHub Client ID，无法发起 GitHub 登录。',
      confirm: {
        importTitle: '确认导入并覆盖',
        importBody: '将从 Gist {gistId} 下载 term-state.base64 并覆盖本地 TermState。此操作不可撤销，确认继续？',
        cancel: '取消',
        importConfirm: '确认导入'
      },
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
        termStateMissing: 'TermState 未加载，请稍后重试',
        syncing: '正在生成快照并同步...',
        syncSuccess: '同步成功：{url}',
        syncFailed: '同步失败：{error}',
        syncDone: '同步完成',
        gistIdRequired: '请输入 Gist ID',
        gistImporting: '正在从 Gist 导入并覆盖...',
        gistImportSuccess: '导入成功：已覆盖本地 TermState',
        gistImportDone: '导入完成'
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
    specialFilter: '体育课',
    specialTagsLabel: '特殊标签（动态）',
    specialFilterOptions: {
      all: '不过滤',
      sportsOnly: '仅体育',
      excludeSports: '排除体育'
    },
    creditRange: '学分区间',
    minPlaceholder: '最小',
    maxPlaceholder: '最大',
    capacityMin: '容量下限',
    languageMode: '教学语言/异常课程',
    noLimit: '不限',
    teachingLanguageLabel: '教学语言',
    teachingModeLabel: '异常课程',
    modeOtherPlaceholder: '其他教学模式（文本包含）',
    abnormalFilterOptions: {
      defaultHidden: '默认隐藏（推荐）',
      showAll: '显示全部（含异常）',
      onlyAbnormal: '只看异常课程',
      mixed: '混合状态'
    },
    abnormalFilterSummaries: {
      defaultHidden: '默认隐藏异常课程',
      showAll: '当前显示全部课程（含异常）',
      onlyAbnormal: '当前只显示异常课程',
      mixed: '异常筛选处于混合状态'
    },
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
    first: '首页',
    prev: '上一页',
    next: '下一页',
    last: '末页',
    jump: '跳转',
    totalPages: '共 {count} 页'
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
    courseCodeLabel: '课程号',
    courseCodePending: '课程号待定',
    creditLabel: '学分',
    creditValue: '{value} 学分',
    creditPending: '学分未定',
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
      dropForbidden: '禁止退课',
      dropForbiddenDesc: '限制是否显示禁止退课的课程',
      locationClosed: '场地未开放',
      locationClosedDesc: '限制是否显示场地/地点未开放的课程',
      classClosed: '停开',
      classClosedDesc: '限制是否显示停开/暂停的课程',
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
