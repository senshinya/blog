---
title: 6. 其他计算机系统知识
date: 2024-08-12T23:30:00+08:00
---

### 计算机语言

* 指令包含表达式、流程控制和集合
  * 表达式包含变量常量字面量和运算符
  * 流程控制包含分支循环函数和异常
  * 集合包含字符串数组散列表
* 计算机语言分类
  * 机器语言：最早，二进制代码，包含操作码、操作地址、操作结果的存储地址、下条指令的地址
  * 常见指令格式：三地址（两操作数+1结果地址）、二地址（1操作数+1操作数和结果地址）、单地址（1操作数+固定寄存器存放结果）、零地址（堆栈顶操作数和结果地址）、可变地址数
  * 汇编语言：汇编程序将汇编语言翻译成机器语言。包含三种语句：指令、伪指令、宏指令
  * 指令和伪指令格式：名字（标号）、操作符、操作数、注释
  * 高级语言
  * 建模语言
  * 形式化语言
* 形式化方法的开发过程：可行性分析、需求分析、体系结构设计、详细设计、编码、测试发布

### 多媒体

* 媒体是信息的表现形式
* 多媒体分类
  * 感觉媒体：用户接触信息的感觉形式，视觉听觉触觉
  * 表示媒体：信息的表示形式，图像声音视频
  * 表现（显示）媒体：表现和获取信息的物理设备
  * 存储媒体：存储表示媒体的物理介质
  * 传输媒体：传输表示媒体的物理介质
* 多媒体特征
  * 多维化多样化
  * 集成性
  * 交互性
  * 实时性
* 多媒体系统的关键技术
  * 视音频技术
  * 通信技术
  * 数据压缩技术
* 数据压缩技术
  * 即时压缩和非即时压缩，信息在传输过程中是被压缩还是信息压缩后再传输
  * 数据压缩和文件压缩，数据压缩通常是一些有时间性的数据
  * 无损压缩和有损压缩
* 虚拟现实 VR 和增强现实 AR
  * VR 是创建和体验虚拟世界
  * 虚拟实体是用计算机生成的一个逼真的实体
  * 用户可以通过人的自然技能与环境交互
  * 借助一些三维传感设备完成交互
  * AR 将虚拟实体通过虚拟仿真后叠加到现实世界
* AR 包含以下技术
  * 计算机图形图像技术
  * 空间定位技术
  * 人文智能
* VR/AR 技术分为 桌面式、分布式、沉浸式和增强式

### 系统工程

* 是指计算机作为工具，对系统的结构、元素、信息和反馈等进行分析，达到最优规划、最优设计、最优管理和最优控制的目的
* 系统之系统 SoS
* 系统工程方法是一种现代的科学决策方法，进行全面的分析和处理
* 霍尔三维结构，将系统工程活动过程分为前后紧密衔接的7个阶段和7个步骤，形成由时间维、逻辑维和知识维组成的三维空间结构
  * 时间维表示从开始到结束按时间顺序排列，分为规划、拟定方案、研制、生产、安装、运行、更新 7 个时间阶段
  * 逻辑维指每个阶段要进行的工作内容和应该遵循的思维程序，包括明确问题、确定目标、系统综合、系统分析、优化、决策、实施
  * 知识维指运用各种知识和技能
* 切克兰德方法，解决社会经济系统中的问题，核心不是最优化而是比较和探寻。从模型和现状的比较中来学习改善现状的途径。将工作过程分为七个步骤
  * 认识问题
  * 根底定义
  * 建立概念模型
  * 比较和探寻
  * 选择
  * 设计与实施
  * 评估与反馈
* 并行工程方法，产品及其相关过程进行并行、集成化处理的系统方法和综合技术。要求从设计开始就考虑产品生命周期的全过程。目标提高质量、降低成本、缩短开发周期和产品上市时间。强调
  * 在产品的设计开发器件
  * 各项工作由与此相关的项目小组完成
  * 依据适当的信息系统工具、反馈和协调整个项目的进行
* 综合集成法。钱学森等，开放的复杂巨系统（子系统数量巨大、种类多关联复杂、开放），从定性到定量。是从整体上考虑并解决问题。是现代科学条件下认识方法论的一次飞跃。
  * 原则：整体性原则，相互联系原则，有序性原则，动态原则
  * 性质：开放性、复杂性、进化与涌现性、层次性、巨量性
  * 主要特点：定性研究与定量研究、科学理论与经验知识
* WSR（物理、事理、人理）：懂物理、明事理、通人理。分为7步
  * 理解意图
  * 制定目标
  * 调查分析
  * 构造策略
  * 选择方案
  * 协调关系
  * 实现构想
* 系统工程生命周期 7 阶段
  * 探索性研究
  * 概念
  * 开发
  * 生产
  * 使用
  * 保障
  * 退役
* 生命周期方法
  * 计划驱动方法：始终遵守规定流程
  * 渐进迭代式开发：初始能力、随之提供连续交付以达到期望
  * 精益开发：向客户交付最大价值并使浪费活动最小化
  * 敏捷开发
* 基于模型的系统工程 MBSE
  * 建模方法的形式化应用，以建模方法支持系统需求、分析、设计、验证和确认等活动
  * 系统工程过程的三个阶段产生三种图形
    * 需求分析：需求图、用例图和包图
    * 功能分析与分配：顺序图、活动图和状态机图
    * 设计综合：模块定义图、内部块图和参数图
  * 三大支柱：建模语言 SysML、建模工具、建模思路