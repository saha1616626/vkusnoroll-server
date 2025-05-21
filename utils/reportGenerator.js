// Утилита для генерации отчета PDF или Excel

const pdfMake = require('pdfmake/build/pdfmake.js');
const pdfFonts = require('pdfmake/build/vfs_fonts.js');
const ExcelJS = require('exceljs');

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

        // Текущая дата в формате "дд.мм.гггг чч:мм"
        const now = new Date();
        const formattedDate =
            `${String(now.getDate()).padStart(2, '0')}.` +
            `${String(now.getMonth() + 1).padStart(2, '0')}.` +
            `${now.getFullYear()} ` +
            `${String(now.getHours()).padStart(2, '0')}:` +
            `${String(now.getMinutes()).padStart(2, '0')}`;

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

                { text: `Тип отчёта: ${reportData.reportType}`, margin: [0, 20, 0, 0] },

                // Блок с датой генерации
                {
                    text: `Сформировано: ${formattedDate}`,
                    style: 'dateStyle',
                    margin: [0, 2, 0, 20]
                },

                // Блок фильтров
                { text: "Применённые фильтры:", style: "subheader", margin: [0, 0, 0, 0] },
                ...Object.entries(reportData.filters).map(([key, value]) => ({
                    text: `${key}: ${value}`,
                    margin: [0, 2]
                })),

                // Пустая строка
                { text: '', margin: [0, 10], },

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

    // Стили для ячеек
    const headerStyle = { // Заголовок
        font: { bold: true, color: { argb: 'FFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F81BD' } },
        alignment: { vertical: 'middle', horizontal: 'center' },
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    };

    const dateStyle = { // Время
        font: { size: 10, italic: true },
        alignment: { horizontal: 'center' }
    };

    const dataCellStyle = { // Таблица
        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
        alignment: { vertical: 'middle', horizontal: 'left' }
    };

    // Заголовок отчёта
    worksheet.mergeCells('B2:C2');
    worksheet.getCell('B2').value = `Отчёт ${reportData.reportType}`;
    worksheet.getCell('B2').style = {
        font: { bold: true, size: 14 },
        alignment: { horizontal: 'center' }
    };

    // Дата генерации
    const now = new Date();
    const formattedDate =
        `${String(now.getDate()).padStart(2, '0')}.` +
        `${String(now.getMonth() + 1).padStart(2, '0')}.` +
        `${now.getFullYear()} ` +
        `${String(now.getHours()).padStart(2, '0')}:` +
        `${String(now.getMinutes()).padStart(2, '0')}`;

    worksheet.mergeCells('B3:C3');
    worksheet.getCell('B3').value = `Сформировано: ${formattedDate}`;
    worksheet.getCell('B3').style = dateStyle;

    // Блок фильтров
    let rowIndex = 5;
    worksheet.getCell(`B${rowIndex}`).value = 'Применённые фильтры:';
    worksheet.getCell(`B${rowIndex}`).style = { font: { bold: true } };

    Object.entries(reportData.filters).forEach(([key, value]) => {
        rowIndex++;
        worksheet.getCell(`B${rowIndex}`).value = key;
        worksheet.getCell(`C${rowIndex}`).value = value;
    });

    // Пустая строка после фильтров
    rowIndex += 2;

    // Добавляем колонку № и выбранные колонки
    const columns = ['№', ...reportData.columns.filter(col => col !== "№")];
    const startCol = 2; // Начинаем с колонки B

    // Заголовки таблицы
    columns.forEach((col, index) => {
        const cell = worksheet.getRow(rowIndex).getCell(startCol + index);
        cell.value = col;
        cell.style = headerStyle;
    });

    // Данные таблицы
    reportData.data.forEach((row, idx) => {
        const dataRow = worksheet.addRow([]); // Пустая строка
        columns.forEach((col, colIndex) => {
            const cell = dataRow.getCell(startCol + colIndex);
            cell.value = colIndex === 0 ? idx + 1 : row[col] || '-';
            cell.style = dataCellStyle;
            // Форматирование чисел
            if (['Всего заказов', 'Средний чек'].includes(col)) {
                cell.numFmt = '#,##0.00';
            }
        });
    });

    // Итоговая статистика
    const statsRow = worksheet.rowCount + 2;
    worksheet.getCell(`B${statsRow}`).value = 'Итоги:';
    worksheet.getCell(`B${statsRow}`).style = { font: { bold: true } };

    Object.entries(reportData.stats).forEach(([key, value], idx) => {
        worksheet.getCell(`B${statsRow + idx + 1}`).value = key;
        worksheet.getCell(`C${statsRow + idx + 1}`).value =
            typeof value === 'string' && value.includes('—') ? value : Number(value) || 0;
        // worksheet.getCell(`C${statsRow + idx + 1}`).numFmt = '#,##0.00'; // Все данные в блоке становятся в формате «0,00»
    });

    // Авто-ширина для колонок
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
            const length = cell.value?.toString().length || 0;
            if (length > maxLength) maxLength = length;
        });
        column.width = Math.min(maxLength + 5, 30);
    });

    return workbook.xlsx.writeBuffer();
};