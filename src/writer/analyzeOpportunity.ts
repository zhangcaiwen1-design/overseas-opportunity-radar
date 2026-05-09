import type {
  OpportunityContentAngle,
  OpportunityProjectType,
  OpportunitySignal,
  OpportunityValidationStep,
  SelectedWrittenOpportunity,
} from '../types';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'opportunity';
}

function toSourceLabel(source: OpportunitySignal['source']) {
  switch (source) {
    case 'github':
      return 'GitHub 项目';
    case 'hackernews':
      return 'Hacker News 信号';
    case 'reddit':
      return 'Reddit 讨论';
    case 'rss':
      return 'RSS 来源';
    case 'sample':
      return '本地示例';
  }
}

function detectProjectType(signal: OpportunitySignal): OpportunityProjectType {
  const joined = `${signal.title} ${signal.summary} ${signal.tags.join(' ')}`.toLowerCase();

  if (/(sdk|router|platform|infra|foundation|cask|toolkit|runtime|middleware|homebrew|cli workflow)/.test(joined)) {
    return 'capability-foundation';
  }

  if (/(workflow|framework|agent|pipeline|automation|sop|operating)/.test(joined)) {
    return 'workflow-collaboration';
  }

  if (/(crm|order|booking|lead|shop|store|quote|payment|checkout|reservation|sales)/.test(joined)) {
    return 'business-frontend';
  }

  return 'tool-enhancement';
}

function buildProjectLabel(signal: OpportunitySignal, projectType: OpportunityProjectType) {
  switch (projectType) {
    case 'tool-enhancement':
      return `工具机会：${signal.title}`;
    case 'workflow-collaboration':
      return `协作流程机会：${signal.title}`;
    case 'business-frontend':
      return `前台生意机会：${signal.title}`;
    case 'capability-foundation':
      return `底座封装机会：${signal.title}`;
  }
}

function buildOneLiner(projectType: OpportunityProjectType, signal: OpportunitySignal) {
  switch (projectType) {
    case 'tool-enhancement':
      return `这是一个偏工具增强型的项目，适合给需要提升单点效率的人使用，核心是把“${signal.summary}”这类动作做得更快、更省人工。`;
    case 'workflow-collaboration':
      return `这是一个偏工作流协作型的项目，它不只是一个功能点，而是在组织“${signal.summary}”这类任务如何分工、衔接与交付。`;
    case 'business-frontend':
      return `这是一个偏业务前台型的项目，重点不在底层技术炫技，而在把“${signal.summary}”包装成可以直接承接客户需求的业务入口。`;
    case 'capability-foundation':
      return `这是一个偏能力底座型的项目，本身更像底层能力模块，真正的机会在于把“${signal.summary}”封装成面向国内细分场景的解决方案。`;
  }
}

function buildProjectIntro(projectType: OpportunityProjectType, signal: OpportunitySignal) {
  switch (projectType) {
    case 'tool-enhancement':
      return `“${signal.title}”本质上是一个解决具体效率问题的小工具，核心价值不是做大而全的平台，而是把用户原本需要手工完成的步骤压缩成更顺手的产品动作。它更适合被理解为一个高频小能力，而不是完整商业系统。`;
    case 'workflow-collaboration':
      return `“${signal.title}”更像一套流程框架或协作样板，重点不是单点功能，而是把任务输入、角色分工、执行衔接和最终交付组织起来。它不是一个拿来就能直接卖的成品，而是一套很值得拿来本地改造的协作机制。`;
    case 'business-frontend':
      return `“${signal.title}”更接近一个能直接面对客户的业务前台雏形，重点在于承接需求、组织服务和推动成交。它不是单纯的内部工具，而是能被包装成小商家、服务团队或线下经营者前台入口的项目原型。`;
    case 'capability-foundation':
      return `“${signal.title}”更像底层技术底座，本身未必直接面对终端客户，但它能支撑上层产品快速搭建。它不该被误解成现成生意，而应该被看成一个可二次封装、可切行业场景的能力组件。`;
  }
}

function buildOperationModel(projectType: OpportunityProjectType, signal: OpportunitySignal): string[] {
  switch (projectType) {
    case 'tool-enhancement':
      return [
        `用户先提供与“${signal.title}”相关的原始内容、文件或待处理对象。`,
        '工具负责把最耗时、最重复的一步自动完成，减少反复切换软件或手工整理的时间。',
        '处理好的结果再回到用户原本的剪辑、发布、整理或交付流程里继续使用。',
      ];
    case 'workflow-collaboration':
      return [
        '先由发起方提供目标、上下文和需要推进的任务。',
        '中间环节按角色或按智能体分工拆开执行，分别负责检索、判断、生成或复核。',
        '最后再由人工做收口与交付，把一次执行沉淀成可重复使用的流程资产。',
      ];
    case 'business-frontend':
      return [
        '先通过页面、表单、私域入口或对话入口承接客户需求。',
        '系统把零散需求整理成可跟进、可报价、可交付的业务动作。',
        '再通过服务交付、复购提醒或持续跟进把一次咨询变成持续生意。',
      ];
    case 'capability-foundation':
      return [
        '底层模块先处理统一的技术能力，例如安装、路由、编排或标准化调用。',
        '上层团队再围绕具体行业场景做包装，把通用能力变成能被非技术用户消费的产品。',
        '真正的商业闭环不是卖底座本身，而是卖基于底座搭出来的行业解决方案。',
      ];
  }
}

function buildWhyItMatters(projectType: OpportunityProjectType, signal: OpportunitySignal): string[] {
  const sourceReason = `它来自 ${toSourceLabel(signal.source)}，说明这不是凭空想出来的话题，而是已经在真实社区或真实项目里出现的需求信号。`;

  switch (projectType) {
    case 'tool-enhancement':
      return [
        sourceReason,
        '这类工具型项目往往切的是高频小痛点，只要能明显节省时间，就容易在细分人群里形成稳定需求。',
        '它适合先做轻量验证，不需要先搭大而全平台，就能测试国内用户是否愿意为效率买单。',
      ];
    case 'workflow-collaboration':
      return [
        sourceReason,
        '这类项目最有价值的不是代码本身，而是它已经帮你演示了一条任务如何被拆分、协作和交付。',
        '如果你面向的是服务团队、内容团队或运营团队，这种流程样板比单功能工具更有迁移价值。',
      ];
    case 'business-frontend':
      return [
        sourceReason,
        '它贴近真实经营链路，更容易直接映射到获客、成交和交付场景。',
        '这种项目即使不是大赛道，也可能在细分行业里形成稳定的小生意，而不是只停留在演示层。',
      ];
    case 'capability-foundation':
      return [
        sourceReason,
        '底座型项目本身不一定直接赚钱，但它能明显降低你做行业封装、工具集成或内部系统交付的起步成本。',
        '如果国内已经有相似需求但缺少顺手方案，这类底座就很适合被二次包装成更接地气的产品。',
      ];
  }
}

function buildChinaAdaptation(projectType: OpportunityProjectType, signal: OpportunitySignal): string[] {
  switch (projectType) {
    case 'tool-enhancement':
      return [
        `先不要照搬“${signal.title}”的原始使用语境，而是优先判断它能嵌进国内哪条真实工作流，例如微信接单、社群内容整理或本地文件处理。`,
        '入口上优先改成微信、企微、表单或本地客户端能承接的形态，减少国内用户重新学习一整套新流程的成本。',
        '如果原项目强调个人探索体验，落到国内时要更强调结果导向，例如更快出稿、更快整理、更快交付。',
      ];
    case 'workflow-collaboration':
      return [
        '先把海外的协作链路拆成国内常见角色，例如老板、运营、客服、执行、复核，而不是直接照搬国外团队分工。',
        '协作工具优先替换为企微、飞书、微信群、共享表格或表单系统，确保信息能在国内团队的常用环境里流转。',
        '先删掉不必要的复杂自动化，保留最能提效的两三个协作节点，用半自动方案先跑通。',
      ];
    case 'business-frontend':
      return [
        '把海外入口替换成更符合国内成交习惯的承接方式，例如企微私聊、微信表单、小程序页、抖音私信或小红书留资。',
        '支付和成交方式不要默认依赖订阅，先考虑按次收费、套餐收费、代搭建收费或线下转化。',
        '交付链路也要本地化，优先接入人工客服、微信群跟进或企微持续服务，而不是假设用户会独立完成全流程。',
      ];
    case 'capability-foundation':
      return [
        `不要把“${signal.title}”直接当成终端产品卖，而要先选一个细分行业场景做包装，例如内容团队内部工具、门店经营助手或服务公司交付底座。`,
        '对外展示时弱化技术名词，强化业务结果，告诉客户它能让什么流程更稳、更快或更省人。',
        '先做轻量封装和演示版，把底层能力变成可被非技术用户理解和购买的方案。',
      ];
  }
}

function buildMonetizationExecution(projectType: OpportunityProjectType): string[] {
  switch (projectType) {
    case 'tool-enhancement':
      return [
        '先卖给明确有重复效率痛点的小团队、个体创作者或服务从业者，而不是一开始面向所有人。',
        '第一版更适合卖代处理服务、效率增强工具包或轻量桌面工具，而不是重平台订阅。',
        '收费可以先按次、按项目或按月小额收费，等验证出高频需求再考虑标准化订阅。',
      ];
    case 'workflow-collaboration':
      return [
        '优先卖给已经有人但流程混乱的服务团队、内容团队或运营团队。',
        '第一版最适合卖“流程代搭建 + SOP 落地 + 陪跑优化”，而不是单卖一套代码。',
        '获客可以先从熟人团队、行业群、企微私域或展示型内容里找第一批客户，再逐步沉淀成标准化方案。',
      ];
    case 'business-frontend':
      return [
        '优先卖给已经有线索但前台承接粗糙的小商家、门店老板或服务型团队。',
        '第一版可以直接卖“报价承接页 + 跟进流程 + 交付模板”这样的最小闭环方案。',
        '收费更适合按搭建费、首月服务费或单店版本收费，第一批客户可从私域关系、老客户介绍和本地行业群切入。',
      ];
    case 'capability-foundation':
      return [
        '不要直接卖底座名词，而是卖一个基于底座封装好的行业解决方案。',
        '第一版更适合通过项目制收费、内部工具交付费或二次开发费变现。',
        '第一批客户最好来自已经明确有数字化需求的团队，例如内容公司、服务商、门店连锁或内部运营团队。',
      ];
  }
}

function buildContentAngles(projectType: OpportunityProjectType, signal: OpportunitySignal): OpportunityContentAngle[] {
  switch (projectType) {
    case 'tool-enhancement':
      return [
        { channel: 'wechat-article', angle: `拆解“${signal.title}”这类工具，看看它如何把一个高频小动作做成可卖效率机会。` },
        { channel: 'douyin', angle: `一个海外小工具，为什么有机会在国内变成省时赚钱的小产品？` },
      ];
    case 'workflow-collaboration':
      return [
        { channel: 'wechat-article', angle: `重点讲“${signal.title}”背后的协作模式，说明它为什么适合服务团队和内容团队借鉴。` },
        { channel: 'douyin', angle: '这不是一个普通工具，而是一条能直接拿来改造的 AI 协作流程。' },
      ];
    case 'business-frontend':
      return [
        { channel: 'wechat-article', angle: `把“${signal.title}”当成一个前台生意原型，重点拆它怎么承接需求和怎么成交。` },
        { channel: 'douyin', angle: '海外这种前台产品，搬到国内更像一个能直接卖钱的小生意入口。' },
      ];
    case 'capability-foundation':
      return [
        { channel: 'wechat-article', angle: `重点写“${signal.title}”不是终端产品，但为什么很适合被包装成国内行业解决方案。` },
        { channel: 'douyin', angle: '很多人会忽略这种底座项目，但真正闷声赚钱的机会常常在二次封装。' },
      ];
  }
}

function buildValidationSteps(projectType: OpportunityProjectType, signal: OpportunitySignal): OpportunityValidationStep[] | undefined {
  if (projectType === 'business-frontend') {
    return [
      {
        title: '先做最小承接页',
        detail: `围绕“${signal.title}”对应的需求，先做一个能收集客户需求和联系方式的最小前台页。`,
      },
      {
        title: '找真实需求试跑',
        detail: '拿给 3 个已经有类似业务动作的商家或服务从业者试用，观察他们是否愿意拿它承接真实咨询。',
      },
      {
        title: '验证成交闭环',
        detail: '重点看它是否能帮客户更快报价、更快跟进或更快促成首次成交，再决定是否继续做标准化。',
      },
    ];
  }

  if (projectType === 'workflow-collaboration' && /agent|framework|workflow/i.test(`${signal.title} ${signal.summary}`)) {
    return [
      {
        title: '先跑一个真实协作任务',
        detail: '选一条真实内容生产、资料整理或客户交付任务，用这套流程手工+半自动跑一遍。',
      },
      {
        title: '记录卡点和返工',
        detail: '重点看哪些环节最容易返工、最需要人工兜底，再决定保留哪几个自动化节点。',
      },
      {
        title: '验证团队接受度',
        detail: '如果团队愿意连续一周按这条链路协作，再考虑把它沉淀为正式服务或行业版方案。',
      },
    ];
  }

  return undefined;
}

export function analyzeOpportunity(signal: OpportunitySignal): SelectedWrittenOpportunity {
  const projectType = detectProjectType(signal);

  return {
    slug: slugify(signal.title),
    title: buildProjectLabel(signal, projectType),
    sourceLabel: toSourceLabel(signal.source),
    projectType,
    oneLiner: buildOneLiner(projectType, signal),
    projectIntro: buildProjectIntro(projectType, signal),
    operationModel: buildOperationModel(projectType, signal),
    whyItMatters: buildWhyItMatters(projectType, signal),
    chinaAdaptation: buildChinaAdaptation(projectType, signal),
    monetizationExecution: buildMonetizationExecution(projectType),
    contentAngles: buildContentAngles(projectType, signal),
    validationSteps: buildValidationSteps(projectType, signal),
  };
}
