document.addEventListener("DOMContentLoaded", () => {
    
    // UI Elementleri
    const uploadInput = document.getElementById("upload-save");
    const downloadBtn = document.getElementById("download-save");
    const rawEditor = document.getElementById("raw-editor");
    const visualEditor = document.getElementById("visual-editor");
    const fileInfo = document.getElementById("file-info");
    const tabs = document.querySelectorAll(".tab");
    const views = document.querySelectorAll(".view-content");
    
    let currentFileName = "";
    let currentData = null; // Parse edilmiş JSON objesi tutar (eğer JSON ise)
    let isJson = false;

    // --- Tab Değiştirme Mantığı ---
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            views.forEach(v => v.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(tab.dataset.target).classList.add("active");
            
            // Eğer görsel editörden raw editöre geçiliyorsa senkronize et
            if (tab.dataset.target === "raw-view" && isJson) {
                rawEditor.value = JSON.stringify(currentData, null, 4);
            }
        });
    });

    // --- Dosya Yükleme ---
    uploadInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        currentFileName = file.name;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            processContent(content, file);
        };
        reader.readAsText(file);
    });

    // --- İçeriği İşleme ve JSON Kontrolü ---
    function processContent(content, file) {
        rawEditor.value = content;
        
        fileInfo.innerHTML = `
            <strong>Dosya:</strong> ${file.name} <br>
            <strong>Boyut:</strong> ${(file.size / 1024).toFixed(2)} KB
        `;

        try {
            // Dosyanın JSON olup olmadığını test et
            currentData = JSON.parse(content);
            isJson = true;
            fileInfo.innerHTML += `<br><strong style="color: var(--success-color);">Format: JSON</strong>`;
            renderVisualEditor(currentData, visualEditor);
        } catch (error) {
            // JSON değilse ham metin olarak bırak
            isJson = false;
            currentData = null;
            fileInfo.innerHTML += `<br><strong style="color: #f59e0b;">Format: Bilinmiyor (Metin)</strong>`;
            visualEditor.innerHTML = `<div class="empty-state"><p>Bu dosya formatı görsel editör tarafından desteklenmiyor. Ham Veri (Raw) sekmesini kullanın.</p></div>`;
        }

        downloadBtn.disabled = false;
    }

    // --- Görsel Editör (Tree/Form) Oluşturma ---
    // Bu fonksiyon JSON objesini okuyup input alanlarına çevirir.
    function renderVisualEditor(data, container, path = "") {
        container.innerHTML = ""; 

        function createNode(obj, currentPath, parentElement) {
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    const value = obj[key];
                    const newPath = currentPath ? `${currentPath}.${key}` : key;

                    if (typeof value === 'object' && value !== null) {
                        // Alt Obje / Dizi
                        const title = document.createElement("div");
                        title.className = "kv-object-title";
                        title.innerText = key;
                        parentElement.appendChild(title);

                        const indent = document.createElement("div");
                        indent.className = "kv-indent";
                        parentElement.appendChild(indent);

                        createNode(value, newPath, indent);
                    } else {
                        // Basit Değer (String, Number, Boolean)
                        const row = document.createElement("div");
                        row.className = "kv-row";

                        const label = document.createElement("div");
                        label.className = "kv-key";
                        label.innerText = key;
                        label.title = key;

                        const input = document.createElement("input");
                        input.type = typeof value === 'number' ? 'number' : 'text';
                        input.className = "kv-val-input";
                        input.value = value;
                        
                        // Input değiştikçe ana currentData objesini güncelle
                        input.addEventListener("input", (e) => {
                            let val = e.target.value;
                            if(typeof value === 'number') val = Number(val);
                            if(typeof value === 'boolean') val = val === 'true';
                            updateDataByPath(currentData, newPath, val);
                        });

                        row.appendChild(label);
                        row.appendChild(input);
                        parentElement.appendChild(row);
                    }
                }
            }
        }

        const rootDiv = document.createElement("div");
        createNode(data, "", rootDiv);
        container.appendChild(rootDiv);
    }

    // JSON içindeki derin (deep) veriyi path (örn: "player.stats.health") ile günceller
    function updateDataByPath(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const deepObj = keys.reduce((o, key) => o[key], obj);
        deepObj[lastKey] = value;
    }

    // --- Araçlar ---
    document.getElementById("btn-base64-decode").addEventListener("click", () => {
        try {
            const decoded = atob(rawEditor.value);
            processContent(decoded, {name: currentFileName + " (Decoded)", size: decoded.length});
        } catch (e) {
            alert("Bu geçerli bir Base64 dizgesi değil!");
        }
    });

    document.getElementById("btn-format-json").addEventListener("click", () => {
        try {
            const parsed = JSON.parse(rawEditor.value);
            rawEditor.value = JSON.stringify(parsed, null, 4);
        } catch (e) {
            alert("Formatlamak için geçerli bir JSON olmalı!");
        }
    });

    // --- Kaydet & İndir ---
    downloadBtn.addEventListener("click", () => {
        let finalContent = rawEditor.value;
        
        // Eğer JSON olarak işlenmişse ve görsel editör güncellenmişse, datayı string yap
        if (isJson) {
            finalContent = JSON.stringify(currentData, null, 4);
        }

        const blob = new Blob([finalContent], { type: "text/plain" });
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
