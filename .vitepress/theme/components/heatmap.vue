<template>
    <div class="cal-heatmap-container">
        <div class="cal-heatmap-header">
            <span class="cal-heatmap-header-title">Github contributions from <a href="https://github.com/senshinya" target="_blank">shinya</a></span>
            <div class="cal-heatmap-legend-container">
                <span class="cal-heatmap-legend-text">less</span>
                <div id="cal-heatmap-legend"></div>
                <span class="cal-heatmap-legend-text">more</span>
            </div>
        </div>
        <div id="cal-heatmap"></div>
    </div>
</template>

<script setup lang="ts">
import CalHeatmap from 'cal-heatmap'
import Tooltip from 'cal-heatmap/plugins/Tooltip'
import LegendLite from 'cal-heatmap/plugins/LegendLite'
import CalendarLabel from 'cal-heatmap/plugins/CalendarLabel'
import 'cal-heatmap/cal-heatmap.css'
import dayjs from 'dayjs'

import { useData, useRouter } from "vitepress"
import { watch } from "vue"
const { isDark } = useData();
const router = useRouter();

const yyDaysTemplate: CalHeatmap.Template = DateHelper => {
    const ALLOWED_DOMAIN_TYPE: CalHeatmap.DomainType[] = ['month'];
    return {
        name: 'yyDay',
        allowedDomainType: ALLOWED_DOMAIN_TYPE,
        rowsCount: () => 7,
        columnsCount: (ts) => {
            // 当前月要额外处理，减少多于空间
            if (DateHelper.date(ts).startOf('month').valueOf() !== DateHelper.date().startOf('month').valueOf()) {
                return DateHelper.getWeeksCountInMonth(ts)
            } else {
                let firstBlockDate = DateHelper.getFirstWeekOfMonth(ts);
                // 计算从今天到第一个块的时间间隔
                let interval = DateHelper.intervals('day', firstBlockDate, DateHelper.date()).length;
                // 计算需要规划几列
                let intervalCol = Math.ceil((interval + 1) / 7);
                return intervalCol;
            }
        },
        mapping: (startTimestamp, endTimestamp) => {
            const clampStart = DateHelper.getFirstWeekOfMonth(startTimestamp);
            const clampEnd = dayjs().startOf('day').add(8 - dayjs().day(), 'day')

            let x = -1;
            const pivotDay = clampStart.weekday();

            return DateHelper.intervals('day', clampStart, clampEnd).map((ts) => {
                const weekday = DateHelper.date(ts).weekday();
                if (weekday === pivotDay) {
                    x += 1;
                }

                return {
                    t: ts,
                    x,
                    y: weekday,
                };
            });
        },
        extractUnit: (ts) => {
            return DateHelper.date(ts).startOf('day').valueOf();
        },
    };
};

function paint(cal: CalHeatmap, theme: 'light' | 'dark') {
    const colorRange = theme == 'dark'?['#0e4429', '#006d32', '#26a641', '#39d353']:['#9be9a8', '#40c463', '#30a14e', '#216e39'];
    cal.addTemplates(yyDaysTemplate);
    cal.paint(
        {
            theme: theme,
            data: {
                source: 'https://github-calendar-api.shinya.click/api?senshinya',
                type: 'json',
                x: 'date',
                y: 'count',
                groupY: 'sum',
            },
            date: {
                start: dayjs().subtract(12, 'month').valueOf(),
                min: dayjs("2023-01-01").valueOf(),
                max: dayjs(),
                locale: 'zh',
                timezone: 'Asia/Shanghai',
            },
            range: 13,
            scale: {
                color: {
                    type: 'threshold',
                    range: colorRange,
                    domain: [2, 4, 6, 8],
                },
            },
            domain: {
                type: 'month',
                gutter: 5,
                label: { text: 'M月', textAlign: 'middle', position: 'bottom' },
            },
            subDomain: { type: 'yyDay', radius: 2, width: 16, height: 16, gutter: 5 },
            itemSelector: '#cal-heatmap',
        },
        [
            [
                Tooltip,
                {
                    text: function (timestamp: number, value: number, dayjsDate: dayjs.Dayjs) {
                        if (!value) {
                            return 'no contributions on ' + dayjsDate.format('YYYY-MM-DD');
                        } else {
                            return value + ' contributions on ' + dayjsDate.format('YYYY-MM-DD');
                        }
                    },
                },
            ],
            [
                LegendLite,
                {
                    itemSelector: '#cal-heatmap-legend',
                    includeBlank: false,
                    radius: 2,
                    width: 14,
                    height: 14,
                    gutter: 5,
                },
            ],
            [
                CalendarLabel,
                {
                    width: 25,
                    textAlign: 'start',
                    text: function () {
                        return ['一', '', '三', '', '五', '', '日']
                    },
                },
            ],
        ]
    );
}

function destory(cal: CalHeatmap) {
    cal.destroy();
}

let cal: CalHeatmap;
watch(
    isDark,
    () => {
        if (cal !== undefined) destory(cal);
        if (isDark.value) {
            cal = new CalHeatmap();
            paint(cal, 'dark');
        } else {
            cal = new CalHeatmap();
            paint(cal, 'light');
        }
    },
    {
        immediate: true,
    }
);
</script>

<style scoped lang="scss">
:deep(.ch-domain-text) {
    font-size: 12px;
    color: var(--vp-home-heatmap-legend-text);
}

:deep(.ch-plugin-calendar-label-text) {
    font-size: 12px !important;
    color: var(--vp-home-heatmap-legend-text);
}

.cal-heatmap-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 40px;
    max-width: 100%;
}

@media screen and (max-width: 768px) {
    .cal-heatmap-container {
        overflow: auto;
    }
}

.cal-heatmap-header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-bottom: 12px;
}

.cal-heatmap-header-title {
    flex: 1;
    font-size: 16px;
    line-height: 24px;
    font-weight: 500;
}

.cal-heatmap-header-direct {
    flex: 1;
}

.cal-heatmap-legend-container {
    display: flex;
    justify-content: space-between;
}

.cal-heatmap-legend-text {
    color: var(--vp-home-heatmap-legend-text);
    font-size: 14px;
}

#cal-heatmap-legend {
    display: flex;
    align-items: center;
    margin: 0 12px;
}
</style>