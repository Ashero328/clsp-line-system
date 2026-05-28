# clsp-line-system
# 📜 Gideon 網頁開發標準規範 (General Standard)

本規範為專案基礎開發準則。AI 在產出代碼或架構建議時，請嚴格遵守以下邏輯。

---

## 📂 1. 目錄結構 (Directory Structure)
所有檔案必須依照功能分類存放，嚴禁在根目錄堆放資源：

* **`/` (Root)**: 僅存放 `index.html` 與 `README.md`。
* **`/css`**: 存放 `style.css` (全域樣式)。
* **`/images`**: 存放所有圖片、圖示 (Icon) 與 SVG 檔案。
* **`/js`**: 
    * `customer_script.js` (存放專案的核心運算與自訂邏輯)。
    * **`/[plugin-name]`**: 第三方套件（如 fullPage.js）需在 `/js` 下建立獨立資料夾管理，內含該套件專屬的 JS 與 CSS。

---

## 🎨 2. CSS 規範：中控室管理 (The Root Control)
禁止在選擇器中直接寫死顏色或數值。

### A. 顏色管理 (Colors)
* 必須於 `:root` 定義所有色標變數。
* **範例**：`--primary-color: #53C8A1;` (蒂芬妮綠)。
* **使用方式**：一律透過 `var(--variable-name)` 調用。

### B. 字體縮放系統 (Dynamic Scaling)
* **基準設定**：在 `:root` 定義 `--base-font-size: 10px;`。
* **全域縮放**：所有字體大小必須使用 `calc()` 配合基準變數進行倍數計算。
* **範例**：`font-size: calc(var(--base-font-size) * 1.5);` (即 15px)。

---

## ⚙️ 3. JS 規範：邏輯分層
* **自訂邏輯**：所有的專案運算邏輯統一寫在 `js/customer_script.js`。
* **插件引用**：第三方特效資源需從其專屬資料夾（如 `/js/fullPage/`）引用，確保不與主程式邏輯混淆。

---

## 🚀 4. AI 協作守則
當我要求新增功能或修改介面時，請 AI 自動執行：
1. **路徑標示**：指明代碼片段應放置於哪個資料夾（`/css` 或 `/js`）。
2. **變數優先**：優先使用 `:root` 已定義的變數，若需新增顏色，請同步更新 `:root` 模塊。
3. **結構整潔**：保持 HTML 結構精簡，並符合上述檔案收納規則。

---
*Generated for Gideon's Development Workflow*