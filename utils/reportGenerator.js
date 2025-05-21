// Утилита для генерации отчета PDF или Excel

const pdfMake = require('pdfmake/build/pdfmake.js');
const pdfFonts = require('pdfmake/build/vfs_fonts.js');

// Инициализация шрифтов
pdfMake.vfs = pdfFonts.vfs;

// Настройка шрифтов
const fonts = {
    Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
    }
};

// Определим шрифты в pdfMake
pdfMake.fonts = fonts;

// Генерация PDF
exports.generatePDF = async (reportData) => {
    try {
        // Добавляем обязательную колонку "№" с порядковым номером
        const processedData = reportData.data.map((row, index) => ({
            "№": `${index + 1}`,
            ...row
        }));

        // Обновляем список колонок: добавляем "№" в начало
        const columns = ["№", ...reportData.columns.filter(col => col !== "№")];

        // Разделение колонок на группы (первая колонка "№" + остальные)
        const maxColumnsPerPage = 8;
        const columnGroups = [];
        for (let i = 0; i < columns.length; i += maxColumnsPerPage) {
            const group = columns.slice(i, i + maxColumnsPerPage);
            // Всегда включаем первую колонку "№" в каждую группу
            if (i > 0 && !group.includes("№")) group.unshift("№");
            columnGroups.push(group);
        }

        // Определение структуры документа
        const docDefinition = {
            pageOrientation: 'landscape', // Альбомная ориентация
            pageSize: 'A4',
            pageBreakBefore: (currentNode, followingNodes) =>
                currentNode.headlineLevel === 1 && followingNodes.length > 0,
            footer: (currentPage, pageCount) => ({
                text: `Страница ${currentPage} из ${pageCount}`,
                alignment: 'right',
                margin: [40, 10]
            }),
            content: [
                { text: "Отчёт по продажам", style: "headerTitle" },

                // Блок фильтров
                { text: "Применённые фильтры:", style: "subheader", margin: [0, 20, 0, 0] },
                ...Object.entries(reportData.filters).map(([key, value]) => ({
                    text: `${key}: ${value}`,
                    margin: [0, 2]
                })),

                // Пустая строка
                { text: '', margin: [0, 10, 0, 0], },

                { text: `Тип отчёта: ${reportData.reportType}`, margin: [0, 10] },

                // Таблица
                ...columnGroups.flatMap((group, groupIndex) => {
                    const table = {
                        table: {
                            headerRows: 1,
                            dontBreakRows: true,
                            widths: [
                                30, // Фиксированная ширина для колонки "№"
                                ...group.slice(1).map(() => '*') // Остальные колонки — автоматическая ширина
                            ],
                            body: [
                                group.map(col => ({
                                    text: col,
                                    style: 'header',
                                    alignment: 'center' // Выравнивание заголовков по центру
                                })), // Заголовки
                                ...processedData.map(row =>
                                    group.map(col => ({
                                        text: row[col] || '-',
                                        style: 'cellStyle'
                                    }))
                                )
                            ]
                        },
                        layout: {
                            fillHeader: (i, node) => i < node.table.headerRows,
                            // paddingBottom: () => 10,
                            hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
                            vLineWidth: () => 0.5,
                            fillColor: (rowIndex) => rowIndex === 0 ? '#d6d6d6' : null
                        }
                    };

                    // Добавляем разрыв после таблицы, кроме последней
                    return groupIndex < columnGroups.length - 1
                        ? [table, { text: '', pageBreak: 'after' }]
                        : [table];
                }),

                // Итоговая статистика
                { text: "Итоги:", style: "subheader", margin: [0, 20, 0, 0] },
                ...Object.entries(reportData.stats).map(([key, value]) => ({
                    text: `${key}: ${value}`,
                    margin: [0, 2]
                }))
            ],

            // Стили
            styles: {
                headerTitle: { // Заголовок отчета
                    bold: true,
                    fontSize: 14,
                    alignment: 'center',
                    margin: [0, 5, 0, 5]
                },
                header: {
                    bold: true,
                    fontSize: 10,
                    alignment: 'center',
                    margin: [0, 5, 0, 5]
                },
                subheader: { fontSize: 10, bold: true, margin: [0, 5] },
                cellStyle: {
                    fontSize: 8,
                    margin: [2, 2],
                    lineHeight: 1.2
                }
            },
            defaultStyle: {
                font: 'Roboto',
                fontSize: 8,
                lineHeight: 1.2,
                characterSpacing: 0.2,
                wordBreak: 'break-word', // Перенос длинных слов
            }
        };

        // Создание PDF
        return new Promise((resolve) => {
            const pdfDoc = pdfMake.createPdf(docDefinition);
            pdfDoc.getBuffer(resolve);
        });
    } catch (error) {
        console.error('PDF generation error:', error);
        throw error;
    }
};

// Генерация Excel
exports.generateExcel = (reportData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Отчёт');

    // Добавляем заголовки фильтров
    worksheet.addRow(['Применённые фильтры:']);
    Object.entries(reportData.filters).forEach(([key, value]) => {
        worksheet.addRow([key, value]);
    });

    // Добавляем таблицу
    worksheet.addRow(reportData.columns);
    reportData.data.forEach(row => {
        worksheet.addRow(reportData.columns.map(col => row[col]));
    });

    // Добавляем итоги
    worksheet.addRow(['Общая выручка', reportData.stats.totalRevenue]);

    return workbook.xlsx.writeBuffer();
};