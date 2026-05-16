document.addEventListener("DOMContentLoaded", () => {
    const uploadInput = document.getElementById("upload-save");
    const downloadBtn = document.getElementById("download-save");
    const fileInfo = document.getElementById("file-info");
    const tabs = document.querySelectorAll(".tab");
    const views = document.querySelectorAll(".view-content");
    
    let currentFileName = "";
    let fileBuffer = null; // Dosyanın ham baytlarını tutar
    let uint8Array = null; // Düzenlenebilir bayt dizisi
    let isGVAS = false;

    // Tab Değiştirme
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            views.forEach(v => v.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(tab.dataset.target).classList.add("active");
        });
    });

    // Dosyayı ArrayBuffer olarak okuma (GVAS desteği için kritik bölüm)
    uploadInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        currentFileName = file.name;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            fileBuffer = event.target.result;
            uint8Array = new Uint8Array(fileBuffer);
            processBinaryFile(file);
        };
        // readAsText YERİNE readAsArrayBuffer kullanıyoruz!
        reader.readAsArrayBuffer(file); 
    });

    function processBinaryFile(file) {
        downloadBtn.disabled = false;
        
        // GVAS Kontrolü (İlk 4 bayt: 47 56 41 53)
        isGVAS = false;
        if (uint8Array.length >= 4) {
            const magic = String.fromCharCode(uint8Array[0], uint8Array[1], uint8Array[2], uint8Array[3]);
            if (magic === 'GVAS') isGVAS = true;
        }

        fileInfo.innerHTML = `
            <strong>Dosya:</strong> ${file.name} <br>
            <strong>Boyut:</strong> ${(file.size / 1024).toFixed(2)} KB <br>
            <strong>Format:</strong> ${isGVAS ? '<span style="color:#10b981">UE4 GVAS (Binary)</span>' : 'Bilinmeyen Binary/Metin'}
        `;

        // Eğer dosya GVAS ise veya binary ise doğrudan Hex Editör tabını aç
        if (isGVAS) {
            document.querySelector('[data-target="hex-view"]').click();
            renderHexEditor();
            document.getElementById("raw-editor").value = "Bu bir GVAS (Binary) dosyasıdır. Lütfen Hex Editör sekmesini kullanın.";
        } else {
            // Normal metin dosyasıysa text'e çevirmeye çalış
            const textDecoder = new TextDecoder("utf-8");
            document.getElementById("raw-editor").value = textDecoder.decode(uint8Array);
            document.querySelector('[data-target="raw-view"]').click();
        }
    }

    // Hex Editör Oluşturucu
    function renderHexEditor() {
        const hexBody = document.getElementById("hex-body");
        hexBody.innerHTML = ""; // Temizle

        // Performans için sadece ilk 1024 satırı (yaklaşık 16KB) renderlayalım.
        // GVAS dosyaları genellikle bu aralıktadır.
        const maxBytesToRender = Math.min(uint8Array.length, 16384); 
        
        let htmlContent = "";
        
        for (let i = 0; i < maxBytesToRender; i += 16) {
            let hexRow = `<div class="hex-row">`;
            
            // Offset (Sol sütun)
            hexRow += `<div class="hex-offset-col">${i.toString(16).padStart(8, '0').toUpperCase()}</div>`;
            
            // Hex Baytları (Orta sütun)
            let hexBytes = "";
            let asciiChars = "";
            
            for (let j = 0; j < 16; j++) {
                if (i + j < maxBytesToRender) {
                    const byte = uint8Array[i + j];
                    const hexValue = byte.toString(16).padStart(2, '0').toUpperCase();
                    
                    // Düzenlenebilir bayt span'ı
                    hexBytes += `<span class="hex-byte" data-index="${i+j}" title="Tıkla ve değiştir">${hexValue}</span> `;
                    
                    // ASCII karakterini çıkar (Yazdırılamayan karakterler için nokta koy)
                    asciiChars += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : ".";
                } else {
                    hexBytes += "   "; // Boşluk
                }
            }
            
            hexRow += `<div class="hex-bytes-col">${hexBytes}</div>`;
            
            // ASCII Karakterleri (Sağ sütun)
            // HTML karakter karışıklığını önlemek için replace kullanıyoruz
            asciiChars = asciiChars.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            hexRow += `<div class="hex-ascii-col">${asciiChars}</div>`;
            
            hexRow += `</div>`;
            htmlContent += hexRow;
        }
        
        hexBody.innerHTML = htmlContent;

        // Baytları tıklayıp düzenleme özelliği
        document.querySelectorAll('.hex-byte').forEach(span => {
            span.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                const currentHex = this.innerText;
                const newHex = prompt(`Adres: 0x${index.toString(16).toUpperCase()}\nMevcut Değer: ${currentHex}\nYeni değeri girin (Örn: FF, 0A, vb.):`, currentHex);
                
                if (newHex && /^[0-9A-Fa-f]{1,2}$/.test(newHex)) {
                    const newByte = parseInt(newHex, 16);
                    uint8Array[index] = newByte; // Bellekteki Array'i güncelle
                    this.innerText = newHex.padStart(2, '0').toUpperCase(); // Arayüzü güncelle
                    this.style.color = "var(--success-color)"; // Değiştiğini belli et
                } else if (newHex !== null) {
                    alert("Lütfen sadece geçerli bir Onaltılık (Hex) sayı girin! (00 - FF arası)");
                }
            });
        });
    }

    // Kaydet ve İndir Butonu (Düzenlenmiş Binary Dosyasını İndir)
    downloadBtn.addEventListener("click", () => {
        let blob;
        
        // Eğer dosya GVAS/Binary ise güncellenmiş uint8Array'i indir
        if (isGVAS) {
            blob = new Blob([uint8Array], { type: "application/octet-stream" });
        } else {
            // Metin dosyasıysa Textarea'dan al
            const finalContent = document.getElementById("raw-editor").value;
            blob = new Blob([finalContent], { type: "text/plain" });
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "edited_" + currentFileName;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    });
});
