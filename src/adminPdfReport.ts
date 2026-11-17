import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface BloodRequestItem {
  id: string;
  patientName: string;
  hospital: string;
  bloodGroup: string;
  rhesus: string;
  bags: number;
  component: string;
  timestamp: string;
  status: string;
  ward: string;
}

declare global {
  interface Window {
    showToast?: (title: string, message: string, type?: string) => void;
    exportAdminRequestsPdf?: () => void;
  }
}

function getRequestsFromState(): BloodRequestItem[] {
  const state = window.bloodState as
    | (typeof window.bloodState & { requests?: BloodRequestItem[] })
    | undefined;
  return state?.requests ?? [];
}

export function exportAdminRequestsPdf(): void {
  const allRequests = getRequestsFromState();
  const filterSelect = document.getElementById(
    'admin-request-filter'
  ) as HTMLSelectElement | null;
  const filterVal = filterSelect?.value ?? 'all';

  const filteredRequests = allRequests.filter((r) =>
    filterVal === 'all' ? true : r.status === filterVal
  );

  if (filteredRequests.length === 0) {
    window.showToast?.(
      'Data Kosong',
      `Tidak ada permohonan dengan status "${filterVal}" untuk dicetak.`,
      'warning'
    );
    return;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const now = new Date();
  const printDateStr = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const printTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')} WITA`;

  // Header Kop BDRS RSUD Toto Kabila
  doc.setFillColor(220, 38, 38); // Crimson red-600
  doc.rect(14, 14, 182, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('BLOODCONNECT · BDRS RSUD TOTO KABILA', 14, 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Jl. Kesehatan No. 25, Tilongkabila, Kabupaten Bone Bolango, Provinsi Gorontalo',
    14,
    28.5
  );

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 32, 196, 32);

  // Judul Dokumen
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('LAPORAN RINGKASAN PERMOHONAN DARAH MASUK', 14, 40);

  // Metadata cetak
  const filterLabel =
    filterVal === 'all' ? 'Semua Status' : `Status: ${filterVal}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tanggal Cetak : ${printDateStr}, ${printTimeStr}`, 14, 46);
  doc.text(`Filter Data   : ${filterLabel}`, 14, 51);
  doc.text(`Unit Pelapor  : Admin Bank Darah (Pusat Kendali BDRS)`, 14, 56);

  // Ringkasan Statistik
  const totalRequests = filteredRequests.length;
  const totalBags = filteredRequests.reduce((sum, item) => sum + item.bags, 0);
  const countWaiting = filteredRequests.filter(
    (r) => r.status === 'Menunggu'
  ).length;
  const countApproved = filteredRequests.filter(
    (r) => r.status === 'Disetujui'
  ).length;
  const countRejected = filteredRequests.filter(
    (r) => r.status === 'Ditolak'
  ).length;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 61, 182, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Total Permohonan: ${totalRequests} Pasien`, 18, 67.5);
  doc.text(`Total Kebutuhan: ${totalBags} Kantong`, 72, 67.5);
  doc.text(
    `Menunggu: ${countWaiting}  |  Disetujui: ${countApproved}  |  Ditolak: ${countRejected}`,
    18,
    73
  );

  // Tabel Data Permohonan
  const tableRows = filteredRequests.map((req, index) => [
    String(index + 1),
    req.id,
    `${req.patientName}\n(${req.ward})`,
    req.hospital,
    `${req.bloodGroup}${req.rhesus} (${req.component})`,
    `${req.bags} ktg`,
    req.timestamp,
    req.status,
  ]);

  autoTable(doc, {
    startY: 82,
    head: [
      [
        'No',
        'No. Tiket',
        'Nama Pasien',
        'RS Tujuan',
        'Golongan',
        'Jumlah',
        'Waktu Pengajuan',
        'Status',
      ],
    ],
    body: tableRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [220, 38, 38],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { cellWidth: 23, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 16 },
      7: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const val = String(data.cell.raw);
        if (val === 'Disetujui') {
          data.cell.styles.textColor = [22, 163, 74];
        } else if (val === 'Ditolak') {
          data.cell.styles.textColor = [220, 38, 38];
        } else {
          data.cell.styles.textColor = [217, 119, 6];
        }
      }
    },
  });

  // Tanda tangan petugas di bawah tabel
  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 150;
  const signY = Math.min(finalY + 14, 260);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Bone Bolango, ${printDateStr}`, 138, signY);
  doc.text('Petugas Admin Bank Darah (BDRS)', 138, signY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('RSUD Toto Kabila', 138, signY + 21);

  const dateSlug = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}${String(now.getDate()).padStart(2, '0')}`;
  const fileName = `Laporan-Permohonan-BDRS-${dateSlug}.pdf`;
  doc.save(fileName);

  window.showToast?.(
    'Laporan PDF Diunduh',
    `Ringkasan ${totalRequests} permohonan darah berhasil diunduh (${fileName}).`,
    'success'
  );
}

window.exportAdminRequestsPdf = exportAdminRequestsPdf;
