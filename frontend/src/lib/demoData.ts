import { UserProfile } from "@/types/profile";

export const demoProfile: UserProfile = {
  basic_info: {
    name: "张三",
    university: "北京交通大学（211）",
    major: "通信工程",
    rank: "1/96",
    gpa: "3.96/4.00",
    avg_score: "93.9",
    phone: "12222222222",
    email: "123456@163.com",
    self_intro:
      "北京交通大学通信工程专业大三学生，专业排名1/96，GPA 3.96/4.00。研究方向涵盖深度强化学习、自动驾驶、光学器件设计与大语言模型Agent记忆架构。以第一/共一作者身份发表SCI论文2篇（含一篇SCI二区在审），第三作者身份发表CCF-A会议论文1篇（ICML 2026）。曾两次获得国家奖学金，多次获得国家级学科竞赛奖项。",
  },
  course_scores: [
    { name: "数字信号处理", score: "95" },
    { name: "高级交流电", score: "95" },
    { name: "模拟电子技术", score: "98" },
    { name: "数字电子技术", score: "98" },
  ],
  achievements: [
    {
      type: "paper",
      title:
        "COIRL-AD: Collaborative–Competitive Imitation–Reinforcement Learning in Latent World Models for Autonomous Driving",
      level: "ICML 2026 Accepted（CCF-A）",
      date: "2026",
      description: "第三作者，提出一种创新的自动驾驶双策略框架",
    },
    {
      type: "paper",
      title:
        "A novel DOE surface design method based on reinforcement learning architecture",
      level: "Journal of Physics D: Applied Physics（SCI三区 Accepted）",
      date: "2025",
      description: "共一作者，提出基于SAC深度强化学习的新型衍射光学元件表面设计方法",
    },
    {
      type: "paper",
      title:
        "Method for Generating Structured Light Fields by Coherent Beam Combining with Diffractive Optical Elements",
      level: "Optics Letters（SCI二区 Under Review）",
      date: "2025",
      description: "第一作者",
    },
    {
      type: "competition",
      title: "全国大学生数学建模竞赛",
      level: "国家级二等奖",
      date: "2025",
      description: "",
    },
    {
      type: "competition",
      title: "全国大学生物理实验竞赛",
      level: "国家级二等奖",
      date: "2025",
      description: "实现了干涉、衍射、偏振等11个物理实验的动态仿真",
    },
    {
      type: "competition",
      title: "美国大学生数学建模竞赛",
      level: "M奖（Meritorious Winner）",
      date: "2025",
      description: "",
    },
    {
      type: "honor",
      title: "国家奖学金",
      level: "国家级（2次：2024、2025）",
      date: "2024-2025",
      description: "",
    },
    {
      type: "honor",
      title: "三好学生、优秀学生干部",
      level: "校级（2024、2025）",
      date: "2024-2025",
      description: "",
    },
  ],
  projects: [
    {
      title: "基于SAC的光学衍射元件分束的面型设计",
      role: "核心成员",
      duration: "2024.05 – 2025.06",
      description:
        "提出基于SAC深度强化学习的新型衍射光学元件（DOE）表面设计方法，有效克服了传统算法易陷入局部最优的局限，成功实现高精度的2至5束均匀分束。",
      tech_stack: "Python, PyTorch, SAC, 标量衍射理论",
      contribution:
        "负责基于标量衍射理论的光学分束仿真环境搭建，参与SAC深度强化学习算法框架搭建与模型训练流程。分束均匀性误差低至0.46%，均方根误差保持在0.005%至3.77%之间，元件平均衍射效率超过98.5%。产出SCI三区论文已录用。",
    },
    {
      title: "端到端的自动驾驶世界模型",
      role: "核心成员",
      duration: "2024.12 – 2025.12",
      description:
        "提出一种创新的自动驾驶双策略框架，在Latent World Model中将IL与强化学习RL解耦，两者通过竞争机制选择性地共享经验。",
      tech_stack: "Python, PyTorch, nuScenes, Navsim",
      contribution:
        "负责长尾数据集的建立和实验：基于LAW的表现过滤出L2误差大和碰撞率高的样本子集进行测试。子集1的L2误差降低到0.71m，平均碰撞率降低至0.09%；子集2碰撞率大幅压低至0.47%。产出ICML 2026论文。",
    },
    {
      title: "LLM Agent Memory",
      role: "项目负责人",
      duration: "2025.09 – 2026.04",
      description:
        "针对模型在multi-turn中的上下文遗忘问题，优化agent记忆架构，设计了一种动态记忆长短期更新策略。",
      tech_stack: "Python, LLM, MCTS",
      contribution:
        "作为项目负责人，负责项目前期调研；设计并搭建从短时到长期的agent记忆框架，基于MCTS进行动态经验更新，负责文章撰写。预计投递至CCF-A会议。",
    },
    {
      title: "基于MATLAB的波动光学教学辅助程序开发",
      role: "项目负责人",
      duration: "2024.04 – 2025.05",
      description:
        "利用MATLAB实现对大学物理波动光学内容进行仿真和软件设计，用户可以在软件界面动态调整相关物理参数观察光学现象。",
      tech_stack: "MATLAB, GUI设计",
      contribution:
        "负责项目整体统筹与核心算法开发，设计干涉和衍射的数值仿真算法，实现物理参数实时调节与光强分布动态可视化。获2025全国大学生物理实验竞赛国家级二等奖。",
    },
    {
      title: "基于ComfyUI的多角色一致性保持工作流设计",
      role: "核心成员",
      duration: "2025.07 – 2025.09",
      description:
        "基于ComfyUI平台，综合运用Flux、LoRA、Omnigen2、Qwen-Image等模型，探索从参数微调、prompt engineering到模型训练的多样化解决方案。",
      tech_stack: "ComfyUI, Flux, LoRA, Omnigen2",
      contribution:
        "负责搭建并优化四种FLUX工作流（文生图、图生图、图像修复与内容扩展），训练LoRA模型实现角色面部与服装特征的高保真复现，系统测评多模型在角色一致性与细节保持下的量化对比。",
    },
  ],
  student_work: [
    {
      title: "分团长",
      organization: "学校青年志愿者服务团",
      duration: "2024 – 2025",
      description: "负责志愿者服务团日常管理与活动组织",
    },
    {
      title: "团支书",
      organization: "班级",
      duration: "2023 – 至今",
      description: "班级团务管理",
    },
  ],
  recommendations: [],
  target_schools: [
    {
      id: "ts-001",
      school_name: "北京大学",
      department: "计算机学院",
      program: "计算机科学与技术",
      advisor_name: "朱松纯",
      advisor_direction: "计算机视觉、认知推理、具身智能（Embodied AI）",
      advisor_papers:
        "创立 UCLA 统计视觉与学习实验室（SVIL），发表 Science、PNAS、TPAMI 等顶级论文 300+ 篇，h 指数 80+，现任北京通用人工智能研究院（BIGAI）院长",
      contact_status: "已投申请",
      notes:
        "主页：https://www.stat.ucla.edu/~sczhu/；研究院主页：https://bigai.ai。方向与自动驾驶感知+LLM Agent 结合较好，可重点准备认知计算与 World Model 相关问题。",
    },
    {
      id: "ts-002",
      school_name: "清华大学",
      department: "电子工程系",
      program: "信息与通信工程",
      advisor_name: "张亚勤",
      advisor_direction: "人工智能、自动驾驶、边缘计算与物联网",
      advisor_papers:
        "IEEE Fellow、中国工程院外籍院士，曾任微软亚洲研究院院长、百度总裁，现任清华大学智能产业研究院（AIR）院长",
      contact_status: "意向申请",
      notes:
        "主页：https://air.tsinghua.edu.cn；研究院汇聚产业界资源，适合对落地应用感兴趣的同学，可关注其自动驾驶感知与决策方向。",
    },
  ],
};
