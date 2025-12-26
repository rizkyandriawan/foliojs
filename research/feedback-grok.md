Berikut adalah feedback untuk heuristics pagination Folio berdasarkan analisis mental model, key rules, dan pertanyaan yang diajukan. Saya akan berusaha kritis, spesifik, dan ringkas.

### Feedback pada Simplified Mental Model
1. **Clarity & Consistency**: Modelnya cukup jelas dengan 7 kategori tipe konten dan perlakuan masing-masing. Namun, ada potensi ambiguitas pada "Container" (e.g., `div` bisa sangat generik, apakah semua `div` diperlakukan sama?). Mungkin perlu spesifikasi tambahan untuk `div` berdasarkan class/role.
2. **Heading Group**: Konsep "minContent together" agak abstrak. Apakah ini berarti minimal 1 elemen konten atau jumlah tertentu baris? Perlu definisi yang lebih eksplisit.
3. **Atomic Elements**: Perlakuan "scale/rotate/clip if oversized" untuk `img` dan elemen lain terdengar masuk akal, tapi belum ada fallback jika semua opsi gagal (misalnya, gambar terlalu besar bahkan setelah clip).

### Feedback pada Key Rules
1. **Rule 1 (Consecutive Headings)**: Memaksa 2×lineHeight content setelah heading group bisa bermasalah jika konten setelahnya sangat pendek atau tidak ada. Mungkin tambahkan fallback rule, seperti "jika konten < 2×lineHeight, ambil semua yang ada."
2. **Rule 3 (Long Lines in Code/Table)**: Penggunaan `↩` dan `↪` sebagai indikator wrap sangat user-friendly, tapi pastikan ini tidak mengganggu accessibility (misalnya, screen readers). Mungkin tambahkan opsi ARIA label atau metadata.
3. **Rule 4 & 5 (Oversized Images/Tables)**: Rotasi page ke landscape adalah solusi kreatif, tapi bisa membingungkan pengguna jika orientasi berubah-ubah di tengah dokumen. Pertimbangkan opsi alternatif seperti "split table into multiple pages" atau "scale down" sebelum rotasi.
4. **Rule 6 (Admonitions)**: Konsep "title + first content = unit" masuk akal, tapi perlu definisi "first content" (1 paragraf? 1 blok?). Jika terlalu panjang, bisa jadi unit ini terlalu besar untuk 1 halaman.

### Jawaban untuk Questions
1. **Edge Cases yang Terlewat**:
   - **Nested Elements**: Bagaimana jika ada elemen bersarang yang kompleks (misalnya, `blockquote` di dalam `li`, atau tabel di dalam admonition)? Perlu aturan prioritas untuk konflik antar kategori.
   - **Dynamic Content**: Bagaimana perlakuan untuk konten yang di-render secara dinamis (misalnya, elemen yang muncul via JS)? Pagination harus handle kasus DOM berubah.
   - **Empty or Near-Empty Pages**: Jika split menghasilkan halaman hampir kosong (misalnya, hanya 1 heading), apakah ada aturan untuk redistribusi?

2. **Rules yang Terlalu Kompleks**:
   - **Rule 1 (Consecutive Headings + 2×lineHeight)**: Seperti disebutkan, ini bisa disederhanakan dengan fallback jika konten setelahnya terlalu pendek.
   - **Rule 4 & 5 (Rotate Page)**: Rotasi page terlalu drastis dan berpotensi mengganggu flow. Mungkin ganti dengan scaling atau splitting sebagai default, dengan rotasi sebagai opsi terakhir.

3. **Categorization ke 7 Types**:
   - Secara umum cukup comprehensive, tapi kategori "Container" terlalu luas. Mungkin tambahkan subkategori atau aturan berbasis class/role (misalnya, `div` sebagai layout vs `div` sebagai content).
   - Belum ada kategori eksplisit untuk konten interaktif (misalnya, form input, expandable sections). Jika Folio digunakan untuk web content, ini perlu dipertimbangkan.

4. **Saran Improvement**:
   - **Priority Rules**: Tambahkan hierarki prioritas untuk konflik antar aturan (misalnya, jika `img` oversized ada di dalam `blockquote`, mana yang didahulukan?).
   - **User Customization**: Berikan opsi bagi pengguna untuk override aturan default (misalnya, disable rotasi page, atur min/max lines untuk orphan/widow).
   - **Accessibility**: Pastikan semua perlakuan (seperti `↩`/`↪` atau rotasi) tidak mengganggu screen readers atau keyboard navigation. Tambahkan tes accessibility ke dalam development cycle.
   - **Performance**: Pertimbangkan dampak performa untuk dokumen besar (misalnya, split code block panjang atau tabel raksasa). Mungkin tambahkan lazy pagination atau chunking.

### Kesimpulan
Heuristics ini sudah solid sebagai dasar, dengan pendekatan yang logis dan user-centric. Namun, ada ruang untuk perbaikan pada edge cases (nested elements, dynamic content), simplifikasi aturan (rotasi page), dan accessibility. Fokus pada fleksibilitas (customization) dan performa akan membuat Folio lebih robust. Saya sarankan untuk menambahkan dokumentasi edge cases dan tes real-world scenario untuk validasi aturan.
