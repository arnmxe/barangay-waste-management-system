import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportPayload {
  title: string;
  columns: string[];
  rows: string[][];
  subtitle?: string;
}

export function downloadCsv(filename: string, payload: ExportPayload): void {
  const escapeCell = (val: string) => {
    const str = String(val ?? "");
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    payload.columns.map(escapeCell).join(","),
    ...payload.rows.map((row) => row.map(escapeCell).join(",")),
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadPdf(filename: string, payload: ExportPayload): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFillColor(22, 101, 52); // #166534
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 64, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(payload.title, 40, 30);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const generatedStr = `Generated: ${new Date().toLocaleString("en-PH")}  |  Barangay San Isidro, Malolos, Bulacan  |  RA 9003 / RA 10173 Compliant`;
  doc.text(payload.subtitle ? `${payload.subtitle}  •  ${generatedStr}` : generatedStr, 40, 48);

  autoTable(doc, {
    startY: 82,
    head: [payload.columns],
    body: payload.rows.length > 0 ? payload.rows : [["No records matching filters"]],
    styles: {
      fontSize: 9,
      cellPadding: 6,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
