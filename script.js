const API_URL = "http://127.0.0.1:8000";
let transaksiData = [];
let deleteId = null;

// ── HELPER ──────────────────────────────────────────────────────────────────

function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID").format(angka);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

// ── 1. NAVIGASI SPA ──────────────────────────────────────────────────────────

function gotoPage(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add("active");

  const activeNav = document.querySelector(`[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add("active");

  const titles = { dashboard: "Dashboard", transaksi: "Manajemen Kas", tambah: "Catat Transaksi" };
  setText("pageTitle", titles[page] || page.charAt(0).toUpperCase() + page.slice(1));

  if (page === "dashboard" || page === "transaksi") {
    loadAllData();
  }

  closeSidebar();
}

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", e => {
    e.preventDefault();
    const page = item.dataset.page;
    if (page === "tambah") resetForm();
    gotoPage(page);
  });
});

// ── 2. KONEKSI STATUS & TOAST ────────────────────────────────────────────────

function setConnectionStatus(state) {
  const connStatus = document.getElementById("connStatus");
  if (!connStatus) return;
  const states = {
    online:   `<span class="dot dot--online"></span><span>Online</span>`,
    offline:  `<span class="dot dot--offline"></span><span>Disconnected</span>`,
    checking: `<span class="dot dot--checking"></span><span>Connecting...</span>`,
  };
  connStatus.innerHTML = states[state] || states.checking;
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  const icon = type === "success" ? "fa-circle-check" : "fa-circle-xmark";
  toast.innerHTML = `<i class="fa-solid ${icon} toast-icon"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── 3. LOAD DATA DARI BACKEND ────────────────────────────────────────────────

async function loadAllData() {
  try {
    const resSaldo = await fetch(`${API_URL}/saldo`);
    if (!resSaldo.ok) throw new Error(`Saldo fetch failed: ${resSaldo.status}`);
    const dataSaldo = await resSaldo.json();

    setText("cardSaldo",  `Rp ${formatRupiah(dataSaldo.saldo)}`);
    setText("cardMasuk",  `Rp ${formatRupiah(dataSaldo.total_pemasukan)}`);
    setText("cardKeluar", `Rp ${formatRupiah(dataSaldo.total_pengeluaran)}`);
    setText("cardJumlah", `${dataSaldo.jumlah_transaksi ?? 0} transaksi tercatat`);

    const resTx = await fetch(`${API_URL}/transaksi`);
    if (!resTx.ok) throw new Error(`Transaksi fetch failed: ${resTx.status}`);
    const data = await resTx.json();
    transaksiData = Array.isArray(data) ? data : [];

    setConnectionStatus("online");
    renderTables();
  } catch (error) {
    setConnectionStatus("offline");
    console.error("Gagal koneksi ke API:", error);
  }
}

// ── 4. RENDER TABEL ──────────────────────────────────────────────────────────

function getNominal(item) {
  // Kompatibel dengan backend lama (jumlah) maupun baru (nominal)
  return item.nominal ?? item.jumlah ?? 0;
}

function renderTables() {
  const recentBody  = document.getElementById("recentBody");
  const mainBody    = document.getElementById("mainBody");
  const keyword     = document.getElementById("searchInput")?.value.toLowerCase() ?? "";
  const filterJenis = document.getElementById("filterJenis")?.value ?? "";

  const filteredData = transaksiData.filter(item => {
    const matchKeyword =
      (item.keterangan ?? "").toLowerCase().includes(keyword) ||
      (item.kategori   ?? "").toLowerCase().includes(keyword);
    const matchJenis = filterJenis === "" || item.jenis === filterJenis;
    return matchKeyword && matchJenis;
  });

  // Tabel Dashboard — 4 terbaru
  if (recentBody) {
    if (transaksiData.length === 0) {
      recentBody.innerHTML = `<tr><td colspan="6" class="empty-cell">Tidak ada riwayat kas terbaru</td></tr>`;
    } else {
      recentBody.innerHTML = transaksiData.slice(0, 4).map(item => `
        <tr>
          <td>${escapeHtml(item.tanggal)}</td>
          <td><strong>${escapeHtml(item.keterangan)}</strong></td>
          <td><span class="badge badge--ghost">${escapeHtml(item.kategori ?? "-")}</span></td>
          <td>${escapeHtml(item.admin ?? "-")}</td>
          <td><span class="badge ${item.jenis === 'pemasukan' ? 'badge--masuk' : 'badge--keluar'}">${escapeHtml(item.jenis?.toUpperCase())}</span></td>
          <td class="${item.jenis === 'pemasukan' ? 'nominal-masuk' : 'nominal-keluar'}">
            ${item.jenis === 'pemasukan' ? '+' : '-'} Rp ${formatRupiah(getNominal(item))}
          </td>
        </tr>
      `).join("");
    }
  }

  // Tabel Manajemen Kas — dengan filter
  if (mainBody) {
    if (filteredData.length === 0) {
      mainBody.innerHTML = `<tr><td colspan="8" class="empty-cell">Data transaksi tidak ditemukan</td></tr>`;
      setText("tableFooter", "Menampilkan 0 hasil");
    } else {
      mainBody.innerHTML = filteredData.map(item => `
        <tr>
          <td>#${escapeHtml(String(item.id))}</td>
          <td>${escapeHtml(item.tanggal)}</td>
          <td><strong>${escapeHtml(item.keterangan)}</strong></td>
          <td>${escapeHtml(item.kategori ?? "-")}</td>
          <td>${escapeHtml(item.admin ?? "-")}</td>
          <td><span class="badge ${item.jenis === 'pemasukan' ? 'badge--masuk' : 'badge--keluar'}">${escapeHtml(item.jenis?.toUpperCase())}</span></td>
          <td class="${item.jenis === 'pemasukan' ? 'nominal-masuk' : 'nominal-keluar'}">
            Rp ${formatRupiah(getNominal(item))}
          </td>
          <td>
            <div class="action-group">
              <button class="btn btn--icon btn--detail" data-id="${item.id}" title="Detail"><i class="fa-solid fa-eye"></i></button>
              <button class="btn btn--icon btn--edit"   data-id="${item.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn--icon btn--del"    data-id="${item.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `).join("");
      setText("tableFooter", `Menampilkan ${filteredData.length} entri transaksi`);
    }

    mainBody.querySelectorAll(".btn--detail").forEach(btn =>
      btn.addEventListener("click", () => openDetailModal(Number(btn.dataset.id))));
    mainBody.querySelectorAll(".btn--edit").forEach(btn =>
      btn.addEventListener("click", () => prepareEditForm(Number(btn.dataset.id))));
    mainBody.querySelectorAll(".btn--del").forEach(btn =>
      btn.addEventListener("click", () => {
        const item = transaksiData.find(t => t.id === Number(btn.dataset.id));
        if (item) triggerDeleteModal(item.id, item.keterangan);
      }));
  }
}

// ── 5. SUBMIT FORM (CREATE & UPDATE) ────────────────────────────────────────

document.getElementById("transaksiForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const editId = document.getElementById("editId").value;
  const jumlah = parseInt(document.getElementById("fieldNominal").value, 10);

  if (isNaN(jumlah) || jumlah < 1) {
    showToast("Nominal harus berupa angka lebih dari 0.", "error");
    return;
  }

  // Kirim field 'jumlah' agar cocok dengan schema backend lama
  const payload = {
    jenis:      document.getElementById("fieldJenis").value,
    tanggal:    document.getElementById("fieldTanggal").value,
    keterangan: document.getElementById("fieldKeterangan").value.trim(),
    jumlah,
  };

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;

  try {
    const url    = editId ? `${API_URL}/transaksi/${editId}` : `${API_URL}/transaksi`;
    const method = editId ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    showToast(editId ? "Transaksi berhasil diperbarui!" : "Transaksi baru berhasil disimpan!", "success");
    resetForm();
    gotoPage("transaksi");
  } catch (error) {
    console.error("Submit error:", error);
    showToast("Gagal memproses data ke server.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

// ── 6. MODAL DETAIL & DELETE ─────────────────────────────────────────────────

function openDetailModal(id) {
  const item = transaksiData.find(t => t.id === id);
  if (!item) return;

  const detailBody = document.getElementById("detailBody");
  detailBody.innerHTML = `
    <div class="detail-grid">
      <div class="detail-label">ID Log</div>      <div class="detail-value">#${escapeHtml(String(item.id))}</div>
      <div class="detail-label">Tanggal</div>     <div class="detail-value">${escapeHtml(item.tanggal)}</div>
      <div class="detail-label">Jenis Arus</div>  <div class="detail-value">
        <span class="badge ${item.jenis === 'pemasukan' ? 'badge--masuk' : 'badge--keluar'}">${escapeHtml(item.jenis?.toUpperCase())}</span>
      </div>
      <div class="detail-label">Kategori</div>    <div class="detail-value">${escapeHtml(item.kategori ?? "-")}</div>
      <div class="detail-label">Keterangan</div>  <div class="detail-value"><strong>${escapeHtml(item.keterangan)}</strong></div>
      <div class="detail-label">Petugas</div>     <div class="detail-value">${escapeHtml(item.admin ?? "-")}</div>
      <div class="detail-label">Nominal</div>     <div class="detail-value detail-value--big ${item.jenis === 'pemasukan' ? 'nominal-masuk' : 'nominal-keluar'}">
        Rp ${formatRupiah(getNominal(item))}
      </div>
    </div>
  `;
  document.getElementById("detailModal").classList.add("active");
}

function prepareEditForm(id) {
  const item = transaksiData.find(t => t.id === id);
  if (!item) return;

  document.getElementById("editId").value          = item.id;
  document.getElementById("fieldTanggal").value    = item.tanggal;
  document.getElementById("fieldKategori").value   = item.kategori ?? "";
  document.getElementById("fieldNominal").value    = getNominal(item);
  document.getElementById("fieldKeterangan").value = item.keterangan;
  document.getElementById("fieldAdmin").value      = item.admin ?? "";
  document.getElementById("fieldJenis").value      = item.jenis;

  document.querySelectorAll("#jenisToggle .toggle-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.val === item.jenis);
  });

  setText("formTitle",    "Ubah Catatan Transaksi");
  setText("formSubtitle", `Mengedit ID Transaksi: #${item.id}`);
  setText("submitLabel",  "Simpan Perubahan");

  gotoPage("tambah");
}

function triggerDeleteModal(id, keterangan) {
  deleteId = id;
  const descEl = document.getElementById("deleteDesc");
  if (descEl) descEl.textContent = `"${keterangan}" (ID: #${id})`;
  document.getElementById("deleteModal").classList.add("active");
}

document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
  if (!deleteId) return;
  const confirmBtn = document.getElementById("confirmDeleteBtn");
  confirmBtn.disabled = true;
  try {
    const res = await fetch(`${API_URL}/transaksi/${deleteId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    showToast("Data transaksi telah berhasil dihapus.", "success");
    closeModal("deleteModal");
    loadAllData();
  } catch (error) {
    console.error("Delete error:", error);
    showToast("Gagal menghapus transaksi.", "error");
  } finally {
    confirmBtn.disabled = false;
  }
});

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
  if (modalId === "deleteModal") deleteId = null;
}

// ── 7. RESET FORM ────────────────────────────────────────────────────────────

function resetForm() {
  document.getElementById("transaksiForm").reset();
  document.getElementById("editId").value     = "";
  document.getElementById("fieldJenis").value = "pemasukan";
  document.getElementById("fieldAdmin").value = "Chandra H.";

  document.querySelectorAll("#jenisToggle .toggle-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.val === "pemasukan");
  });

  setText("formTitle",    "Tambah Transaksi Baru");
  setText("formSubtitle", "Isi data transaksi kas RW dengan lengkap");
  setText("submitLabel",  "Simpan Transaksi");
}

// ── 8. TOGGLE JENIS ──────────────────────────────────────────────────────────

document.querySelectorAll("#jenisToggle .toggle-btn").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("#jenisToggle .toggle-btn").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    document.getElementById("fieldJenis").value = button.dataset.val;
  });
});

// ── 9. LIVE SEARCH & FILTER ──────────────────────────────────────────────────

document.getElementById("searchInput")?.addEventListener("input", renderTables);
document.getElementById("filterJenis")?.addEventListener("change", renderTables);

// ── 10. SIDEBAR MOBILE ───────────────────────────────────────────────────────

const menuToggle   = document.getElementById("menuToggle");
const sidebar      = document.getElementById("sidebar");
const overlay      = document.getElementById("overlay");
const sidebarClose = document.getElementById("sidebarClose");

function closeSidebar() {
  sidebar?.classList.remove("open");
  overlay?.classList.remove("active");
}

if (menuToggle && sidebar && overlay && sidebarClose) {
  menuToggle.addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("active");
  });
  sidebarClose.addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);
}

// ── 11. INISIALISASI ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  loadAllData();
  setInterval(() => {
    const formPage = document.getElementById("page-tambah");
    if (!formPage?.classList.contains("active")) {
      loadAllData();
    }
  }, 5000);
});