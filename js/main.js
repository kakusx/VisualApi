$(function () {
    var resultData = [];
    //region 获取数据
    $("#getDataBtn").click(function () {
        var api = $("#apiInput").val();
        $.get(api, function (result) {
            $("#dataAttrsBody").empty();
            $(".attr-sel").empty();
            if (Array.isArray(result) && result.length > 0) {
                var keys = Object.keys(result[0]);
                $.each(keys, function (i, key) {
                    var select = '';
                    if (typeof result[0][key] === "number") {
                        select = "<select class='data-process'>" +
                            "<option value='' selected>不处理</option>" +
                            "<option value='date'>日期</option>" +
                            "<option value='log'>对数</option>" +
                            "</select>";
                    }

                    $("#dataAttrsBody").append(`<tr data-key="${key}">
                            <td>${key}</td>
                            <td><input type="text" class="alias"/></td>
                            <td>${select}</td>
                            <td><a class="removeAttr">&times;</a></td>
                            </tr>`);

                    $(".attr-sel").append(`<option value=${key}>${key}</option>`);
                });
                $("#groupSel").prepend(`<option value='' selected>无</option>`);

            }
            resultData = result;

            $("#apiData").val(JSON.stringify(result)
                .replace(/\\/g, "")
                .replace(/,"/g, ',\n"')
                .replace(/\{/g, "{\n")
                .replace(/\},/g, "\n},\n"));
        });
    });
    //endregion

    $('input[name="chartType"]').change(function () {
        var chartType = $('input[name="chartType"]:checked').val();
        $(".attr-sel").parent().hide();
        $(`.attr-sel[data-show*=${chartType}]`).parent().show();
    }).change();

    $("body").on("click", ".removeAttr", function () {
        $(this).parent().parent().remove();
    })
        //region 绘图
        .on("click", "#drawChartBtn", function () {
            $("#g2chart").empty();
            const x = $("#xSel").val();
            const y = $("#ySel").val();
            const label = $("#labelSel").val();
            const val = $("#valSel").val();
            const group = $("#groupSel").val();
            const type = $('input[name="chartType"]:checked').val();
            const keyMap = {};
            $("#dataAttrsBody tr").each(function (i, dom) {
                const key = $(this).data("key");
                const process = $(this).find(".data-process").val();
                const alias = $(this).find(".alias").val();
                keyMap[key] = {
                    process: process,
                    alias: alias
                };
            });

            resultData = resultData.filter(o => o[y] != null);

            processKey(x, keyMap, resultData);

            const chart = new G2.Chart({
                container: 'g2chart', // 指定图表容器 ID
                autoFit: true,
                padding: [100, 100],
                height: 400, // 指定图表高度
            });

            //region 按条件过滤数据
            var filterData = resultData;
            var filters = $("#dataFilter").val().trim();
            if (filters != null && filters.length > 0) {
                var filterArr = filters.split("\n");
                $.each(filterArr, function (i, condition) {
                    filterData = parseCondition(condition, filterData);
                });
            }
            chart.data(filterData);
            //endregion

            //region 标尺
            $.each(keyMap, function (key, value) {
                if (~[x, y, group, val, label].indexOf(key) && value != null) {
                    if (value.process === 'log') {
                        chart.scale(key, {
                            alias: value.alias || key,
                            type: 'log',
                            base: 10,
                            nice: true
                        });
                    } else {
                        chart.scale(key, {
                            alias: value.alias || key,
                        });
                    }
                }
            });
            //endregion

            //region  坐标轴配置
            chart.axis(x, {
                title: {
                    style: {
                        fill: '#8C8C8C',
                        fontSize: 20
                    }
                },
                line: {
                    style: {
                        stroke: '#D9D9D9'
                    }
                }
            });
            chart.axis(y, {
                title: {
                    style: {
                        fill: '#8C8C8C',
                        fontSize: 20
                    }
                },
                grid: {
                    line: {
                        style: {
                            stroke: '#D9D9D9'
                        }
                    }
                },
            });
            //endregion

            //region 画图
            switch (type) {
                case 'line':
                    if (group) {
                        chart.line().position(`${x}*${y}`).color(group);
                    } else {
                        chart.line().position(`${x}*${y}`);
                    }
                    break;
                case 'bar':
                    chart.interval().position(`${x}*${y}`);
                    break;
                case 'pie':
                    chart.coordinate('theta', {
                        radius: 1,
                    });
                    chart
                        .interval()
                        .position(val)
                        .color(label)
                        .label(label)
                        .adjust('stack');
                    break;
                case 'stack':
                    chart
                        .interval()
                        .position(`${x}*${y}`)
                        .color(group)
                        .adjust('stack');
                    break;
            }
            chart.tooltip({
                shared: false,
                showMarkers: false,
            });
            chart.interaction('element-active');
            chart.render();
            //endregion
        })
    //endregion
    ;


});

function processKey(key, keyMap, resultData) {
    if (keyMap[key].process === 'date') {
        $.each(resultData, function (i, data) {
            if (data[key]) {
                data[key] = new Date(data[key].toString().replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).toLocaleDateString();
            }
        });
    }
}

/**
 * 解析过滤条件
 * @param condition
 * @param data
 * @returns {*}
 */
function parseCondition(condition, data) {
    var result = data;
    $.each(["<=", ">=", "=", "<", ">"], function (i, compare) {
        result = filterData(data, condition, compare);
    });
    if (~condition.indexOf(" not in ")) {
        const key = condition.split(' not in ')[0].trim();
        const val = condition.split(' not in ')[1].trim();
        return data.filter(o => eval(val).indexOf(o[`${key}`]) < 0);
    } else if (~condition.indexOf(" in ")) {
        const key = condition.split(' in ')[0].trim();
        const val = condition.split(' in ')[1].trim();
        return data.filter(o => eval(val).indexOf(o[`${key}`]) >= 0);
    }
    return result;
}

/**
 * 过滤数据
 * @param data
 * @param condition
 * @param compare
 * @returns {*}
 */
function filterData(data, condition, compare) {
    if (condition.includes(compare)) {
        if (compare === '=') {
            compare = '==';
        }
        const key = condition.split(compare)[0].trim();
        const val = condition.split(compare)[1].trim();
        return data.filter(o => eval(`o['${key}'] ${compare} ${val}`));
    }
    return data;
}
