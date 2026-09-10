---
authorship: human-only
title: "Working at ByteDance for Three Years and Staying Somewhat Sane Is Not Entirely Impossible"
description: "Three years at ByteDance have made time feel strangely accelerated. Amid the changes, I have still managed to hold on to some mental balance. Looking back at the new graduate gazing at distant mountains from the balcony of our Hangzhou office, I can trace how curiosity, workplace challenges, and shifting expectations taught me to find a rhythm of my own."
date: 2024-09-28 16:26:00
categories: [daily]
tags: ["Daily Life", "Work", "Year in Review"]
image: "https://blog-img.774352199.xyz/hnCaht.webp"
---

![Where the title came from](https://blog-img.774352199.xyz/1726828874334.jpg)

Over dinner, a colleague was talking about the car he'd bought when he suddenly said, “Time feels so much faster once you start working.”

Me: “Hard to say. This Friday afternoon was pretty hard to get through.”

I still think of myself as a student—I'm the youngest on the team for now—but, reluctant as I am to admit it, it has been more than three years since I left university. They've been turbulent years, but relatively stable ones too.

There's an old saying at ByteDance: “One year at ByteDance is three years in the outside world.” So here are those “nine years.”

### Finding My Feet

Excluding my internship, I joined ByteDance in Hangzhou at the end of June 2021.

Roll the tape: [Notes from My First Week](https://www.nowcoder.com/share/jump/67966291840886568).

ByteDance rented space in two buildings at Bafang City in Hangzhou, though not the entire buildings: mostly just the top five or six floors of each. The views were pretty good. Leaning on the balcony, I could see EFC in the distance, the most urban-looking part of Yuhang, and the mountains farther south. The scenery just before a storm and after the rain cleared was something else.

I joined a consumer-facing team within Douyin Live. I'd already interned there for two months and helped put together the onboarding documentation, so I knew the people and the business reasonably well. But after my internship, I spent a month back at university handling graduation matters, and by the time I returned, there was suddenly no work assigned to me. I enjoyed a happy stretch of slacking off, along with the last month of double pay for working alternate Saturdays under the “big week, small week” schedule.

One day, my lead and mentor asked whether I'd be willing to help with a business in Beijing. It was a rapidly growing, understaffed B2B platform under the same skip-level manager as us. They were asking that manager to find people wherever possible, and our team had been assigned one slot. Fresh out of university, full of energy, and conveniently free, I eagerly agreed.

I kept working with that Beijing team. The platform was essentially for reporting up the management chain. QPS was low, but its main purpose was producing data for higher-ups, so its priorities were completely different from a consumer product's. Business functionality mattered more than performance; early on, even consistency wasn't a particularly strict requirement. If a call failed, add an alert and have someone look at it. If the impact was small, you might not even fix it. Users weren't constantly clicking around either, so day-to-day maintenance was fairly relaxed.

I arrived just as the platform was going through a major release. A developer in Beijing guided me remotely. My initial tasks were small changes around the edges, mostly to learn the process.

> [!TIP]
> Initial requirements review → detailed requirements review → technical review, where engineering gets involved → development → showcase, where QA gets involved → testing → Launch Review → release

Everything was orderly: one task after another, no distractions. At first, I didn't even know what to say in a technical review and would book a meeting room just to sit there stiffly. Later...

Actually, there wasn't much growth in that “later.” I just got used to it, or numb to it, and gradually stopped taking it all so seriously. A bug before release wasn't the end of the world. Even a production bug could be handled by fixing the data.

Writing business logic in Go was already a fairly free-form affair. Add rapid iteration and no time for refactoring, and “it runs” became the definition of success. The repository grew increasingly wild. Strange, complicated requirements and developers borrowed from all over the place, each with a different style, gradually turned the platform into a big ball of mud.

What did that have to do with me, though? I was just a noob working on little features.

Everything was new when I first joined. I'd even go into the office on weekends and voluntarily work overtime. I was alone at home with nothing to do anyway, so why not? Later, I found something else to occupy myself: I finished [MYDB](https://github.com/CN-GuoZiyang/Mydb) and the accompanying [tutorials](/en/projects/mydb/mydb0). There were plenty of bugs and nowhere near enough testing, but it really got me going. I'd leave work at eight or nine, code until one or two in the morning, then still have time for a shower, games, and a drink before bed at three or four.

I also met plenty of interesting people. We started a small chat group and spent our downtime talking nonsense. ByteDance then was everything I'd imagined an internet company would be: freedom, flat management, no elaborate excuse needed to take leave, whatever software I wanted on my work laptop. Since the pandemic wasn't over, we also worked from home every so often. No clocking in, no mandatory hours. Get to the office after eleven, head out after dinner...

### Throwing Myself into It

I carried on happily until early 2022. Over that time, I went from handling small peripheral tasks to being able to cover an entire domain.

Alibaba has an old saying, often used to console people who've been laid off, or for them to console themselves: “Embrace change.”

> The only constant is change.

The platform was growing rapidly, expanding from livestreaming to all of Douyin. Product changes also meant that the original Beijing development team handed it over. The team taking over happened to be the one I'd originally joined.

So began the handover. My days were spent helping newcomers, meaning people from the new team, work through tasks and sitting in knowledge-sharing sessions. I was already responsible for the budget module, so I held a session of my own. I read the document aloud without much feeling, but it was still my first presentation at the company. We hadn't needed a presentation to pass probation.

As the Beijing developers withdrew, we were suddenly short-staffed. Alongside the budget module, the entire project-management domain landed in my lap. Product happened to propose a major feature at the same time, so my very first task in that domain was essentially to rewrite the whole thing.

The deadline collided with Chinese New Year. It was urgent, so I spent almost the entire holiday coding in the library, apart from New Year's Eve and New Year's Day. Misunderstandings and other mistakes meant rewriting the code three or four times. I was still too inexperienced. I finally just about made the first release after the holiday.

Then came settling old debts, refactoring reviews, and migrating code to a new service. By the way, that migration started in 2022 and still isn't finished. I barely had time to breathe.

I was extremely anxious then and worked a lot of overtime. Handling everyday problems alone kept me busy until ten or eleven; I hardly ever left before ten. I responded by staying up late and cramming in as much leisure time as I could, trying to reclaim the hours work had eaten up. A typical Friday night involved finding a meeting room at the office and drinking until the early hours of Saturday, then going home to sleep 😅.

Strangely, whenever I worked late, my team lead was always there too. At ten or eleven, either I'd tell him it was time to leave or he'd tell me. For convenience, I'd moved into the same complex as the office and walked through the underground car park to get to work. His commute was fifty minutes to an hour each way.

Maybe that's the price of having a family.

With work ending so late, my personal projects and studying mostly stopped. All I wanted when I got home was to drink and sleep. Homemade cocktails gradually gave way to straight vodka or whisky. Drinking went from something that tasted good or gave me a light buzz to something that helped me sleep and eased the anxiety.

### A Change in Direction

> Sometimes I'd rather life stayed the same. Familiar dullness beats unknown risks.

The risks arrived quickly.

In mid-2022, our team got a new skip-level manager, and the atmosphere began to shift. Casual, informal meetings became formal. The development process grew complicated, with countless review steps added to simple procedures. Every decision had to pass through layer after layer of checks.

New metrics sprang up everywhere: bugs per person-day, personnel efficiency ratios, code complexity, and so on. A number being too high or too low usually meant being singled out at the next weekly or fortnightly meeting. Relations between product, engineering, and QA soured. Meetings became exhausting rounds of verbal sparring, office politics, and passing the blame. Being able to concentrate on coding felt like a luxury. Do more, get more wrong; do nothing, get nothing wrong. Pass work off whenever possible. These became survival skills. “A production bug? We'll just fix the data” had turned into “One regression bug can be your death sentence.”

Around the same time, shrinking headcount meant the team began losing people. Many familiar faces left, some by choice and some not. People I used to eat with, slack off with, and leave work with every day became people I might see once a week. Work felt increasingly lonely.

<img src="https://blog-img.774352199.xyz/2024/630b780569e7aa8fa40e1ecc6a189b40.png" style="width: 50%"/>

Whether it was stress showing up physically, years of late nights and drinking, or both, my body started sounding the alarm. More here: [My Journey with Chronic Gastritis](/en/daily/anti-chronic-gastritis).

After losing weight alarmingly fast, 6 kg in a month, I took a hard look at things and decided to ~~give up~~ start looking after myself!

Now I get up at 8:30, go to the office for breakfast, leave straight after dinner at six-something, run for half an hour after work, and try to get to bed before midnight. That last part is still a work in progress.

> [!CAUTION]
> Keep grinding? How am I supposed to do that if I grind myself into an early grave?

Fortunately, the upheaval also drove out quite a few product managers, and the workload dropped sharply. Management did switch to “if there's no work to stir up, stir up trouble for people,” adding yet more checkpoints and rules. Our current skip-level manager also has a distinctly Alibaba flavor, with a fondness for baffling team-building activities and personal talent shows. Another form of torture, really. Still, the platform has settled into low-frequency maintenance, and there aren't so many little things to deal with.

The job market out there is terrible. I'll coast for now.

### Afterword

This three-year retrospective was supposed to be finished in May or June. But product upheaval and health problems hit at the same time, and its title sat in my notes for three months. Only recently, once my health stabilized, did I pick it up again. In those three months, my attitude had shifted from eager and ambitious to “I'll coast for now.” Things really do change.

At least I've managed to hold on to some degree of mental health. Lately, I've been exploring mood tracking and scheduling, trying to become a more disciplined person. So far, the main achievement is being able to see exactly where I'm wasting my time. I'll write about the results in a later post.

The idea of studying abroad has kept resurfacing over the years, especially whenever things go badly. On countless late nights after a busy day, it has crept through my mind like a vine. The closest I came to quitting in these three years was while waiting for a gastroscopy at the hospital, still replying to Feishu messages and handling on-call work. I often ask myself, “Is this salary really worth what it's costing me?” Once I calm down, though, I sigh and force the thought back down.

I don't know whether, three years from now, I'll regret or even resent the person I am today. Perhaps that's the curse of making choices.

> Whatever you choose, even if you choose nothing, you still have to bear the cost.
