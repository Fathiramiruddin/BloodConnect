import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface HospitalBagItem {
  bagId: string;
  bloodGroup: string;
  component: string;
  patientTarget: string;
  receivedDate: string;
  status: string;
}

declare global {
  interface Window {
    exportHospitalBagsPdf?: () => void;
  }
}

function getHospitalBagsFromState(): HospitalBagItem[] {
  const state = window.bloodState as
    | (typeof window.bloodState & { hospitalBags?: HospitalBagItem[] })
    | undefined;
  return state?.hospitalBags ?? [];
}

export function exportHospitalBagsPdf(): void {
  const allBags = getHospitalBagsFromState();
  const filterSelect = document.getElementById(
    'hospital-bag-filter'
  ) as HTMLSelectElement | null;
  const filterVal = filterSelect?.value ?? 'all';

  const filteredBags = allBags.filter((b) =>
    filterVal === 'all' ? true : b.status === filterVal
  );

  if (filteredBags.length === 0) {
    window.showToast?.(
      'Data Kosong',
      `Tidak ada data kantong darah dengan status "${filterVal}" untuk dicetak.`,
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

  // Kop Resmi Rumah Sakit (Aksen Biru Logistik / Crimson Medis)
  doc.setFillColor(37, 99, 235); // Blue-600
  doc.rect(14, 14, 182, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('BLOODCONNECT · RSUD TOTO KABILA', 14, 23);

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
  doc.text('LAPORAN STATUS KANTONG DARAH DITERIMA (BANGSAL & IGD)', 14, 40);

  // Metadata cetak
  const filterLabel =
    filterVal === 'all' ? 'Semua Status' : `Status: ${filterVal}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tanggal Cetak : ${printDateStr}, ${printTimeStr}`, 14, 46);
  doc.text(`Filter Data   : ${filterLabel}`, 14, 51);
  doc.text(`Unit Pelapor  : Penyimpanan Akhir Fisik (Bangsal, Bedah, ICU & IGD)`, 14, 56);

  // Ringkasan Statistik
  const totalBags = filteredBags.length;
  const countStored = filteredBags.filter(
    (b) => b.status === 'Disimpan di Bangsal'
  ).length;
  const countPending = filteredBags.filter(
    (b) => b.status === 'Menunggu Konfirmasi'
  ).length;
  const countReturned = filteredBags.filter(
    (b) => b.status === 'Dikembalikan ke Bank Darah'
  ).length;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 61, 182, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Total Kantong Terdaftar: ${totalBags} Unit`, 18, 67.5);
  doc.text(
    `Disimpan di Bangsal: ${countStored}  |  Menunggu Konfirmasi: ${countPending}  |  Dikembalikan ke BDRS: ${countReturned}`,
    18,
    73
  );

  // Tabel Logistik Kantong Darah
  const tableRows = filteredBags.map((bag, index) => [
    String(index + 1),
    bag.bagId,
    `${bag.bloodGroup} (${bag.component})`,
    bag.patientTarget,
    bag.receivedDate,
    bag.status,
  ]);

  autoTable(doc, {
    startY: 82,
    head: [
      [
        'No',
        'ID Kantong Darah',
        'Golongan',
        'Bangsal / Pasien',
        'Tanggal Terima',
        'Status Fisik',
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
      fillColor: [15, 23, 42], // Slate-900 header matching RS banner
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 25 },
      4: { cellWidth: 34 },
      5: { halign: 'center', cellWidth: 34, fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const val = String(data.cell.raw);
        if (val === 'Disimpan di Bangsal') {
          data.cell.styles.textColor = [22, 163, 74];
        } else if (val === 'Dikembalikan ke Bank Darah') {
          data.cell.styles.textColor = [217, 119, 6];
        } else {
          data.cell.styles.textColor = [37, 99, 235];
        }
      }
    },
  });

  // Tanda tangan petugas
  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 150;
  const signY = Math.min(finalY + 14, 260);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Bone Bolango, ${printDateStr}`, 134, signY);
  doc.text('Petugas Logistik / Bangsal Rawat Inap', 134, signY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('RSUD Toto Kabila', 134, signY + 21);

  const dateSlug = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}${String(now.getDate()).padStart(2, '0')}`;
  const fileName = `Laporan-Logistik-RSUD-Toto-Kabila-${dateSlug}.pdf`;
  doc.save(fileName);

  window.showToast?.(
    'Laporan PDF Diunduh',
    `Ringkasan ${totalBags} kantong darah bangsal berhasil diunduh (${fileName}).`,
    'success'
  );
}

window.exportHospitalBagsPdf = exportHospitalBagsPdf;
