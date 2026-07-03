# PRD: Desktop Sağ Workspace Paneli

## Genel Bakış

Hermes Desktop içindeki sağ taraf deneyimi tek, tutarlı ve ürün seviyesinde bir `RightWorkspace` yüzeyine dönüştürülecek. Bugün preview, file tree, terminal ve review parçaları farklı layout kurallarıyla sağ tarafta açılıyor; hedef Codex benzeri tek panel kabuğu içinde sekmeli, bağlam duyarlı ve korunabilir bir mimari kurmaktır.

Bu çalışma core agent, model tool schema veya backend protokolünü büyütmez. Mevcut desktop bileşenleri yeniden düzenlenir; yeni davranış Electron desktop yüzeyiyle sınırlıdır.

## Problem

Kullanıcı sağ panelde bir artifact preview açabiliyor, dosya ağacını gösterebiliyor ve terminali açabiliyor; fakat bu yüzeyler tek bir ürün deneyimi gibi çalışmıyor. Her özellik kendi kapatma, genişlik, görünürlük ve odak mantığını taşıdığı için panel bazen preview rail, bazen file sidebar, bazen terminal takeover gibi hissediliyor.

Kullanıcı açısından sorunlar:

- Hangi içeriğin sağ panelde aktif olduğu net değil.
- Files, terminal ve review birbirini ezebiliyor veya route değişimine bağlı görünür oluyor.
- Sağ panel aksiyonları ortak değil.
- Dosya ağacı, git review, terminal ve preview aynı çalışma alanına aitmiş gibi davranmıyor.
- Codex app’teki sağ panel standardına kıyasla deneyim parçalı.

## Hedefler

- Sağ tarafı tek bir `RightWorkspace` kabuğuna bağlamak.
- Files, Terminal ve Review modlarını aynı panel sözleşmesiyle çalıştırmak.
- Mevcut bileşenleri yeniden kullanmak; feature’ları baştan yazmamak.
- Artifact, internal URL ve dosya tıklanınca `Files` tab içinde mevcut preview renderer ile açılmasını sağlamak.
- Dosya ağacı ve git review için Codex benzeri çift kolon davranışı tasarlamak.
- Terminalin aynı workspace içinde kalıcı tab olarak çalışmasını sağlamak.
- Layout, resize, close, collapse, maximize ve focus yönetimini tek yerde toplamak.
- TypeScript/nanostore mimari kurallarına uymak.

## Kapsam Dışı

- Core agent tool eklemek.
- Model tool schema değiştirmek.
- Dashboard TUI veya classic CLI davranışını değiştirmek.
- Remote artifact download/cache akışını bu PRD içinde uygulamak.
- Tam kod editörü veya Monaco tab sistemi inşa etmek.
- Çok pencereli floating panel mimarisi.
- Browser automation backend’i, CDP entegrasyonu veya embedded browser yüzeyi eklemek.

## Hedef Kullanıcılar

- Hermes Desktop kullanan geliştirici.
- Artifact, generated file, markdown, image, terminal, repo tree ve git diff arasında sık geçiş yapan kullanıcı.
- Windows lokal desktop + remote gateway senaryosunda çalışan kullanıcı.

## Mevcut Durum Bulguları

- Preview renderer `ChatPreviewRail` ve `PreviewPane` ile `apps/desktop/src/app/chat/right-rail/` altında var; ürün tab’ı olarak değil, `Files` ana view renderer’ı olarak kullanılacaktır.
- Sağ sidebar kabuğu `RightSidebarPane` ile `apps/desktop/src/app/right-sidebar/index.tsx` altında var.
- Terminal yüzeyi `TerminalRail`, `TerminalWorkspace`, `PersistentTerminal` ve terminal store/oturum modülleriyle `apps/desktop/src/app/right-sidebar/terminal/` altında var.
- Review yüzeyi `ReviewPane` ve `ReviewFileTree` ile `apps/desktop/src/app/right-sidebar/review/` altında var.
- Pane açık/kapalı, boyut override ve kayıt mantığı `apps/desktop/src/store/panes.ts` içinde merkezi olarak var.
- Desktop layout şu an `DesktopController` içinde preview/file/review/terminal kolonlarını ayrı koşullarla yönetiyor.
- Browser için desktop tarafında tam sağ panel webview ürünü yok; ilk sürümde browser tab, placeholder ve launcher girdisi kapsam dışıdır.

## Ürün Kararı

Sağ taraf tek bir workspace kabul edilecek:

- Adı: `RightWorkspace`
- Panel identity: tek sağ panel
- İçerik identity: sekmeler ve modlar
- Modlar: `files`, `terminal`, `review`
- Tüm modlar aynı shell içinde açılır.
- `Preview` ayrı ürün tab’ı değildir; `Files` tab içindeki ana render yüzeyidir.
- Her mod kendi layout detayını içerikte yönetir; panel genişliği, kapanma, maximize, focus ve tab seçimi shell tarafından yönetilir.

## Kullanıcı Hikayeleri

### US-001: Sağ Workspace Başlatıcı
**Açıklama:** Kullanıcı olarak sağ panel kapalıyken tek bir başlatıcıdan açabileceğim yüzeyleri görmek istiyorum.

**Kabul Kriterleri:**
- [ ] Sağ panel boşken veya `+` tıklanınca launcher görünür.
- [ ] Launcher seçenekleri `İncele`, `Terminal`, `Dosyalar` olarak listelenir; `Tarayıcı` ve `Yan sohbet` görünmez.
- [ ] Her seçenek ikon ve kısayol alanı destekler.
- [ ] Seçim ilgili tab’ı açar veya mevcut tab’ı aktif eder.
- [ ] Typecheck geçer.

### US-002: Internal URL ve Artifact Dosyalar Yüzeyi
**Açıklama:** Kullanıcı olarak chat içindeki internal URL, artifact veya dosyaya tıkladığımda bunun `Files` tab içinde zengin preview olarak açılmasını istiyorum.

**Kabul Kriterleri:**
- [ ] File/image/markdown artifact tıklaması `Files` tab’ını açar.
- [ ] Internal file URL tıklaması `Files` tab içinde aynı preview renderer ile açılır.
- [ ] Var olan Files tab varsa target değiştirilir ve tab aktif olur.
- [ ] Header path, dosya adı ve target aksiyonlarını gösterir.
- [ ] Link artifact external açılmaya devam eder.
- [ ] Artifacts route’tan çıkmadan panel görünür kalır.

### US-003: Files Tab, Preview ve Tree
**Açıklama:** Kullanıcı olarak dosya ağacını sağ workspace içinde açıp dosya seçtiğimde aynı yüzeyde zengin preview görmek istiyorum.

**Kabul Kriterleri:**
- [ ] `Dosyalar` seçimi `Files` tab’ını aktif eder.
- [ ] Sağ workspace içinde filtrelenebilir dosya ağacı görünür.
- [ ] Dosya seçimi ana içerikte mevcut preview renderer ile açılır.
- [ ] Tree göster/gizle aksiyonu ana view’ı genişletir veya tree kolonunu geri getirir.
- [ ] `...` menüsü yolu kopyala, dosya içeriğini kopyala, zengin görünümü devre dışı bırak/aç aksiyonlarını sunar.
- [ ] Tree state route değişiminde korunur.

### US-004: Review Tab ve Git Tree
**Açıklama:** Kullanıcı olarak git değişikliklerini sağ workspace içinde Codex benzeri incelemek istiyorum.

**Kabul Kriterleri:**
- [ ] `İncele` seçimi `Review` tab’ını açar.
- [ ] Review tab değişiklik sayısı, staged/unstaged durumu ve refresh aksiyonu gösterir.
- [ ] Ana alan diff/staging içeriğini gösterir.
- [ ] Yardımcı tree kolonunda değişmiş dosyalar listelenir.
- [ ] Var olan review işlemleri yeniden kullanılır; git IPC yeniden yazılmaz.

### US-005: Terminal Tab
**Açıklama:** Kullanıcı olarak terminali sağ workspace içinde kalıcı tab olarak kullanmak istiyorum.

**Kabul Kriterleri:**
- [ ] `Terminal` seçimi terminal tab’ını açar.
- [ ] Mevcut terminal oturumu korunur.
- [ ] CWD bilgisi header context alanında görünür.
- [ ] Terminal tab değişiminde process resetlenmez.
- [ ] Terminal panelin ortak resize/collapse davranışını kullanır.

### US-006: Ortak Panel Aksiyonları
**Açıklama:** Kullanıcı olarak sağ paneli tek biçimde kapatmak, küçültmek, büyütmek ve sekme açmak istiyorum.

**Kabul Kriterleri:**
- [ ] Header sağında yalnızca panel genişlet/daralt toggle vardır; `+` tab strip yanında yeni tab menüsünü açar.
- [ ] Aksiyonlar tüm modlarda aynı yerde kalır.
- [ ] Mode-specific aksiyonlar overflow veya context toolbar içinde görünür.
- [ ] Tab `x` sadece tab kapatır; panel açık kalır ve son tab kapanırsa launcher görünür.
- [ ] Panel global aç/kapat davranışı header içindeki tab close davranışından ayrıdır.

## Fonksiyonel Gereksinimler

- FR-1: Desktop sağ tarafında tek bir `RightWorkspace` shell bulunmalıdır.
- FR-1a: Sağ panel açıkken hiç tab yoksa `RightWorkspaceLauncher` görünmelidir. Launcher yalnızca `İncele`, `Terminal`, `Dosyalar` seçeneklerini göstermelidir.
- FR-1b: Header sol alanı tab strip, tab hover close ve `+` yeni tab menüsünden oluşmalıdır.
- FR-1c: Header sağ alanında yalnızca panel genişlet/daralt toggle bulunmalıdır; close/minimize/panel kapat ikonları bulunmamalıdır.
- FR-1d: Header `+` menüsü yalnızca `İncele`, `Terminal`, `Dosyalar` seçeneklerini göstermelidir.
- FR-2: Shell, `files`, `terminal`, `review` tab türlerini desteklemelidir. `preview`, `browser` ve `side-chat` ayrı tab türleri değildir; ilk sürüm kapsam dışıdır.
- FR-3: Her tab `id`, `kind`, `title`, `icon`, `target`, `dirty`, `createdAt`, `lastActiveAt` alanlarını taşımalıdır.
- FR-3a: `review` singleton olmalı; açıksa yeni review tab oluşturulmamalıdır.
- FR-3b: `files` target’lı multi tab desteklemeli; aynı target tekrar açılırsa mevcut tab focus edilmelidir.
- FR-3c: Target yok `Dosya aç` files tab’ı singleton olmalı; birden fazla boş files tab oluşturulmamalıdır.
- FR-3d: `+` menüsü context-aware olmalı; singleton açık olan yüzeyleri gizlemeli veya mevcut tab’ı focus etmelidir.
- FR-4: Sağ panel açık/kapalı durumu mevcut pane store ile uyumlu olmalıdır.
- FR-5: Aktif tab nanostore içinde tutulmalı, prop drilling yapılmamalıdır.
- FR-6: Artifact, internal URL ve dosya açma aksiyonu `openRightWorkspaceTab({ kind: 'files', target })` benzeri merkezi action kullanmalıdır.
- FR-7: Files, Review ve Terminal açma aksiyonları aynı merkezi action katmanından geçmelidir.
- FR-8: Shell header, tab strip ve panel-level actions tüm modlarda ortak kalmalıdır.
- FR-9: Context toolbar aktif tab türüne göre değişmelidir.
- FR-10: Tab layout modeli `single` ve `mainWithTree` varyantlarını desteklemelidir.
- FR-11: Tree göster/gizle aksiyonu sadece `files` ve `review` tablarında görünmelidir.
- FR-12: Tree görünürlüğü panel-global değil tab-local state olmalıdır.
- FR-13: Files ana view mevcut `ChatPreviewRail` / `PreviewPane` davranışını `PreviewSurface` olarak yeniden kullanmalıdır.
- FR-14: Terminal content mevcut terminal session/store modüllerini yeniden kullanmalıdır.
- FR-14a: Terminal entegrasyonu mevcut `PersistentTerminal`, `TerminalSlot`, `TerminalWorkspace`, `TerminalRail` ve terminal store mimarisini değiştirmemelidir.
- FR-14b: RightWorkspace terminal tab yalnızca mevcut terminal slot’unu host etmelidir; terminal instance’ları tab/panel switch sırasında unmount edilmemelidir.
- FR-14c: Panel close veya tab switch terminal process öldürmemelidir; yalnızca explicit terminal close mevcut davranışı çalıştırmalıdır.
- FR-15: Review content mevcut review pane ve git IPC davranışını yeniden kullanmalıdır.
- FR-15a: Review header staged/unstaged dropdown, changed count ve +added/-removed özetini göstermelidir.
- FR-15b: Review toolbar tüm diffleri daralt/genişlet, dosyaya git, unified/split diff, files tree göster/gizle, commit/gönder ve PR aksiyonlarını desteklemelidir.
- FR-15c: Review overflow menüsü yenile, word wrap, full files, rich preview, word diff, whitespace ve git apply kopyalama ayarlarını desteklemelidir.
- FR-15d: Review dosyaya git palette’i changed file list içinde arama yapmalı ve seçimi tree + diff target ile senkronlamalıdır.
- FR-15e: PR aksiyonu GitHub CLI yoksa disabled olmalı ve tooltip ile sebebini açıklamalıdır.
- FR-16: Files content mevcut preview renderer + file tree bileşenleri üzerinden inşa edilmeli; review tree ile ortak `TreeColumn` görsel dili kullanılmalıdır.
- FR-16a: Files tab target yokken `Dosya aç` empty state’i ve `/` breadcrumb göstermelidir.
- FR-16b: Files tree varsayılan açık gelmeli ve tree selection aktif target ile senkron kalmalıdır.
- FR-16c: Files header `...`, `Aç` ve files tree göster/gizle aksiyonlarını desteklemelidir.
- FR-16d: Files overflow menüsü yolu kopyala, dosya içeriğini kopyala ve zengin görünümü devre dışı bırak/aç aksiyonlarını desteklemelidir.
- FR-16e: Files state `target`, `treeVisible`, `richPreviewEnabled`, `selectedPath`, `expandedDirs` ve `filter` alanlarını taşımalıdır.
- FR-17: Geniş ekranda sağ workspace split panel olarak görünmelidir.
- FR-18: Dar ekranda sağ workspace overlay veya takeover davranışı kullanmalıdır.
- FR-19: Panel resize tek yerde yönetilmelidir; içerikler kendi genişlik override’ını üretmemelidir.
- FR-20: Route değişimi aktif tab state’ini silmemelidir.
- FR-21: Panel kapatma terminal process’ini öldürmemelidir.
- FR-22: Tab kapatma terminal tab için açık onay gerektirmeden mevcut terminal close davranışını izlemelidir; running process varsa mevcut terminal güvenli close kuralı geçerli olmalıdır.
- FR-23: Browser tab, browser placeholder ve gerçek embedded browser ilk sürümde uygulanmamalıdır; launcher’da gösterilmemelidir.
- FR-24: UI copy i18n sistemine eklenmelidir.
- FR-25: Kısayollar mevcut shortcut sistemine bağlanmalı veya açıkça follow-up olarak bırakılmalıdır; hardcoded global listener eklenmemelidir.

## Mimari Kararlar

### 1. Yeni Shell

Yeni shell önerisi:

- `apps/desktop/src/app/right-workspace/RightWorkspace.tsx`
- `apps/desktop/src/app/right-workspace/RightWorkspaceHeader.tsx`
- `apps/desktop/src/app/right-workspace/RightWorkspaceLauncher.tsx`
- `apps/desktop/src/app/right-workspace/tabs/FilesWorkspaceTab.tsx`
- `apps/desktop/src/app/right-workspace/tabs/TerminalWorkspaceTab.tsx`
- `apps/desktop/src/app/right-workspace/tabs/ReviewWorkspaceTab.tsx`

### 2. RightWorkspace Header Kararı

Sağ workspace header sade ve sekme odaklıdır. Header, paneli kapatma yüzeyi değil; tab yönetimi ve panel genişlik durumunu yönetme yüzeyidir.

#### Sol Alan: Tab Strip

- Aktif tab pill/chip olarak görünür.
- Tab başlığı target’a göre güncellenir.
- Tab hover durumunda tab başlığının sağ içinde `x` close ikonu görünür.
- `x` sadece ilgili tab’ı kapatır; paneli kapatmaz.
- Son tab kapatılırsa panel açık kalır ve launcher görünür.

#### `+` Yeni Tab Menüsü

- Tab strip sağındaki `+` menüyü açar.
- Menüden yeni workspace tab açılır veya mevcut tab aktif edilir.
- İlk sürüm menü seçenekleri yalnızca:
  - `İncele`
  - `Terminal`
  - `Dosyalar`
- `Tarayıcı` gösterilmez.
- `Yan sohbet` gösterilmez.

#### Sağ Alan: Panel Boyut Toggle

- Header’ın en sağında tek panel size toggle bulunur.
- Bu toggle paneli kapatmaz; sadece genişlet/daralt veya maximize/restore davranışı sağlar.
- Header içinde ayrı close, minimize veya panel kapat butonu bulunmaz.
- Sağ panelin global aç/kapat kontrolü mevcut uygulama chrome/toggle davranışı olarak kalır; `RightWorkspace` header içeriğine karıştırılmaz.

#### Context Toolbar Ayrımı

- Header sadece tab ve panel shell aksiyonlarını taşır.
- Files ve Review özel aksiyonları alt context toolbar veya content header satırında yer alır.
- Böylece header’da feature-specific ikon kalabalığı oluşmaz.

### 3. Tab Instance Policy

RightWorkspace tab açma davranışı Codex benzeri ama Hermes kapsamına göre net kurallıdır.

- `Review` singleton tab’dır. Açıksa tekrar açılmaz; mevcut tab focus edilir.
- `Files` multi tab destekler. Target’lı farklı dosyalar/internal URL’ler farklı Files tab’larında açılabilir.
- Aynı Files target tekrar açılırsa yeni tab açılmaz; mevcut target’lı tab focus edilir.
- Target yok `Dosya aç` Files tab’ı singleton’dır. Birden fazla boş `Dosya aç` tab’ı oluşturulmaz.
- Boş `Dosya aç` tab’ında dosya açıldığında tab target’lı Files tab’a dönüşür; sonra yeni boş `Dosya aç` tab’ı açılabilir.
- `Terminal` mevcut terminal mimarisine uyar; RightWorkspace `Terminal` tab’ı terminal yüzeyini focus eder, yeni terminal instance davranışı mevcut terminal rail/store tarafından belirlenir.
- `+` menüsü context-aware çalışır: singleton açık olan yüzeyler gizlenir veya seçim mevcut tab’ı focus eder.
- `+` menüsünde `Tarayıcı` ve `Yan sohbet` hiçbir durumda gösterilmez.

### 4. Boş Panel Launcher

Sağ panel açıkken hiç tab yoksa `RightWorkspaceLauncher` görünür. Bu yüzey Codex’in boş sağ panel başlatıcısına benzer; fakat ilk sürüm kapsamına göre sadece aktif Hermes yüzeylerini listeler.

- Launcher panelin ortasında sade satır/kart listesi olarak görünür.
- Seçenekler: `İncele`, `Terminal`, `Dosyalar`.
- `Tarayıcı` gösterilmez.
- `Yan sohbet` gösterilmez.
- Her satır ikon, başlık ve varsa kısayol rozeti taşır.
- Satır tıklaması ilgili tab’ı oluşturur veya varsa aktif eder.
- Header’daki `+` aksiyonu da launcher/quick-open davranışını tetikler.
- Sağ üst global panel toggle launcher’dan bağımsızdır; paneli açar/kapatır.
- Panel kapatılıp tekrar açıldığında tab yoksa launcher geri gelir.

### 5. Files İçinde PreviewSurface

`Files` tab ana view olarak ortak `PreviewSurface` kullanır. Bu surface mevcut `ChatPreviewRail` / `PreviewPane` davranışını sarar.

- Internal URL açma → `Files` tab target günceller.
- Artifact açma → `Files` tab target günceller.
- Tree dosya seçimi → `Files` tab target günceller.
- `Files` kendi ayrı read-only renderer’ını yazmaz.
- Rich preview kapatma/açma target-level state olarak tutulur: `files.richPreviewEnabled`.
- Overflow menüsü target aksiyonlarını taşır: yolu kopyala, dosya içeriğini kopyala, zengin görünümü devre dışı bırak/aç.

### 6. Files / Dosyalar Yüzeyi Detay Kararı

`Files` tab, Codex’teki `Dosya aç` yüzeyine karşılık gelir. Bu yüzey preview değildir; dosya açma ve internal URL preview davranışının ürün yüzeyidir.

#### İlk Açılış ve Empty State

- Launcher’dan `Dosyalar` seçilince `Files` tab açılır.
- İlk tab başlığı target yokken `Dosya aç` olur.
- Ana alan empty state gösterir:
  - dosya ikonu
  - başlık: `Dosya aç`
  - açıklama: `Çalışma alanı ağacından bir dosya seç`
- Sağ iç file tree varsayılan olarak açık gelir.
- Breadcrumb target yokken `/` gösterir.

#### Dosya Açılınca

- Tree’den dosya seçimi `Files` target’ını günceller.
- Ana alan mevcut `PreviewSurface` ile dosyayı render eder.
- Tab başlığı seçili dosya adına döner.
- Breadcrumb `repo > klasör > dosya` şeklinde görünür.
- Tree selection aktif dosyayı vurgular.
- Route değişimi target, tree selection ve expanded folders state’ini silmez.

#### Header Aksiyonları

Files header aksiyonları:

- `...` target overflow menüsü.
- `Aç` primary/dropdown aksiyonu.
- Dosyalar tree göster/gizle toggle.

`...` menüsü target varsa aktiftir; target yoksa gizlenir veya disabled olur. Menü aksiyonları:

- Yolu kopyala.
- Dosya içeriğini kopyala.
- Zengin görünümü devre dışı bırak/aç.

`Aç` aksiyonu ilk sürümde mevcut external/open davranışını kullanır. Dropdown genişletmeleri follow-up olabilir: sistemde göster, external editor’da aç, yolu kopyala.

#### Files State

Files tab state alanları:

- `target: PreviewTarget | null`
- `treeVisible: boolean` default `true`
- `richPreviewEnabled: boolean` default `true`
- `selectedPath: string | null`
- `expandedDirs: string[]`
- `filter: string`

### 7. Store

Yeni store önerisi:

- `apps/desktop/src/store/right-workspace.ts`

Public API:

- `openRightWorkspaceTab(input)`
- `selectRightWorkspaceTab(id)`
- `closeRightWorkspaceTab(id)`
- `setRightWorkspaceOpen(open)`
- `toggleRightWorkspace()`
- `updateRightWorkspaceTab(id, patch)`
- `$rightWorkspaceTabs`
- `$activeRightWorkspaceTabId`
- `$activeRightWorkspaceTab`
- `$rightWorkspaceOpen`

Store atoms feature-owned olur; shared state gerektiği için `src/store` altında yaşar.

### 8. Pane Store Uyumu

Mevcut `store/panes.ts` korunur. `RightWorkspace` panel open/width durumunu mevcut pane sistemi üzerinden alır:

- Tek pane id: `right-workspace`
- Eski `preview`, `fileBrowser`, `review`, `terminal` görünürlük gate’leri kademeli olarak bu pane id’ye yönlendirilir.

### 9. DesktopController Sadeleşmesi

`DesktopController` sadece şu kararları vermelidir:

- Sağ workspace açık mı?
- Hangi layout modu: split / overlay / takeover?
- `RightWorkspace` nereye mount edilecek?

Preview, files, terminal ve review detayları `DesktopController` içinde koşullu render edilmemelidir.

### 10. İçerik Adaptörleri

Mevcut bileşenler doğrudan silinmez. İlk uygulama adaptörle ilerler:

- `ChatPreviewRail` / `PreviewPane` → `FilesWorkspaceTab` içindeki `PreviewSurface`
- `RightSidebarPane` files/review parçaları → `FilesWorkspaceTab` ve `ReviewWorkspaceTab`
- `TerminalWorkspace` / `TerminalRail` → `TerminalWorkspaceTab`

Adaptörler stabil olduktan sonra eski right-sidebar gate’leri kaldırılır.

### 11. Codex Benzeri Layout

Codex app gözlemlerine göre:

- Sağ panelde launcher liste görünümü olmalı.
- Header tab strip sabit kalmalı.
- `Review` modunda ana alan diff, yardımcı kolon file tree olmalı.
- `Files` modunda ana alan selected file/open prompt, yardımcı kolon file tree olmalı.
- `Terminal` modunda context toolbar cwd/session bilgisi göstermeli.

### 12. Tab İçi Tree Kolonu

Files ve Review aynı dış sağ workspace panelini kullanır; fakat tree global panel değildir. Tree, aktif tab içindeki yardımcı kolondur.

- `Terminal` tek kolon layout kullanır.
- `Files` ve `Review` `mainWithTree` layout kullanır.
- `Files` iç tree veri kaynağı workspace filesystem ağacıdır.
- `Review` iç tree veri kaynağı git changed-files ağacıdır.
- İki tree aynı `TreeColumn` / `WorkspaceTreeShell` primitive ve aynı görsel dili paylaşır.
- Tree görünürlüğü tab-local state olarak tutulur: `files.treeVisible`, `review.treeVisible`.
- Header’da tree göster/gizle aksiyonu sadece tree destekleyen tab’larda görünür.
- Tree gizlenince ana view genişler; panel kapanmaz.
- Tree toggle sağ üst global panel toggle’dan ayrıdır.

### 13. Terminal Entegrasyon Kararı

Terminal yüzeyi mevcut mimarisiyle korunacaktır. `RightWorkspace` terminali yeniden yazmaz, sahiplenmez veya lifecycle’ını değiştirmez; yalnızca mevcut persistent terminal slot’unu host eder.

#### Korunacak Mevcut Parçalar

- `TerminalWorkspace` terminal instance listesini render etmeye devam eder.
- `PersistentTerminal` fixed overlay + slot ölçüm mimarisini korur.
- `TerminalSlot` panel içindeki anchor/ölçü noktası olarak kalır.
- `TerminalRail` terminal içi tab rail’i ve yeni terminal butonu olarak kalır.
- `TerminalInstance` xterm, selection, add-to-chat ve shell lifecycle davranışını korur.
- Terminal store ve PTY/session lifecycle değiştirilmez.

#### Entegrasyon Modeli

- `RightWorkspace` içinde `Terminal` tab açıldığında mevcut `TerminalPaneChrome` / `TerminalSlot` için ölçülü alan ayrılır.
- `PersistentTerminal` bu slot’a bağlanarak mevcut davranışla terminali gösterir.
- Terminal tab pasifken terminal instance’ları unmount edilmemelidir.
- Panel kapatma terminal process öldürmemelidir.
- Sadece explicit terminal tab/instance close mevcut terminal close davranışını çalıştırır.
- RightWorkspace tab strip ile terminalin kendi `TerminalRail` tab sistemi karıştırılmaz.

#### Yasaklanan Değişiklikler

- Terminali normal unmount/remount edilen React child’a çevirmek.
- `PersistentTerminal` latch/measurement davranışını kaldırmak.
- Terminal store’u RightWorkspace store içine taşımak.
- Terminal rail’i RightWorkspace tab strip’e merge etmek.
- Terminal kapatma davranışını panel close ile eşitlemek.

### 14. Review / İnceleme Yüzeyi Detay Kararı

`Review` tab, Codex benzeri git inceleme yüzeyidir. Amaç chat değil; repo değişikliklerini tree, diff ve git aksiyonlarıyla tek çalışma yüzeyinde yönetmektir.

#### Header Durum Alanı

- Sol durum dropdown: `Staging alanına alınmadı`, `Staging alanına alındı`, `Commit`, `Branch`, `Son tur`.
- Dropdown yanında changed file count badge gösterilir.
- Diff özet sayaçları `+added` ve `-removed` olarak görünür.
- Durum dropdown sadece review kapsamını değiştirir; gerçek commit/push işlemi ayrı aksiyonlarla yapılır.

#### Header Toolbar Aksiyonları

Toolbar aksiyonları ikon + tooltip ile sunulur:

- `...` overflow menüsü.
- Tüm diffleri daralt/genişlet.
- Dosyaya git palette’i.
- Unified/split diff görünümü.
- Dosyalar tree göster/gizle.
- Görünüm/filtre ayarları.
- Commit veya gönder aksiyonu.
- PR aksiyonu; `gh` yoksa disabled ve tooltip: `PR oluşturmak için GitHub CLI yükle`.

#### Overflow Menü

`...` menüsü review görünüm ve kopyalama ayarlarını taşır:

- Yenile.
- Kelime kaydırmayı devre dışı bırak/aç.
- Tam dosyaları yükle.
- Zengin önizlemeyi etkinleştir/devre dışı bırak.
- Kelime difflerini etkinleştir/devre dışı bırak.
- Boşlukları gizle/göster.
- Git apply komutunu kopyala.

#### Ana Alan ve Tree

- Ana alan diff/review surface’tir.
- Sağ iç kolon changed-files tree’dir.
- Tree filter input destekler.
- Dosya seçimi ana diff target’ını günceller.
- Tree gizlenince diff alanı genişler.
- Tree global panel değildir; `Review` tab içi yardımcı kolondur.

#### Dosyaya Git Palette’i

- Toolbar’dan açılır.
- Changed file list içinde arama yapar.
- Sonuçlarda dosya adı ve klasör yolu görünür.
- Seçim ana diff target’ını değiştirir ve tree selection ile senkron kalır.

#### Alt Aksiyon Barı

Review tab altında sticky alt aksiyon barı olabilir:

- Tüm değişiklikleri geri al.
- Tümünü staging alanına al.
- Seçili dosya veya hunk için geri al/stage aksiyonları.
- Aksiyonlar uygun değilse disabled + açıklayıcı tooltip göstermelidir.

#### GitHub CLI ve PR

- PR aksiyonu `gh` varlığına bağlıdır.
- `gh` yoksa PR butonu disabled kalır.
- Disabled tooltip net olmalıdır: `PR oluşturmak için GitHub CLI yükle`.
- `gh` yokluğu review, commit veya push akışını bozmaz.

### 15. Browser ve Yan Sohbet Kapsam Kararı

İlk sürümde browser ve yan sohbet yoktur.

- Launcher’da `Tarayıcı` gösterilmez.
- Launcher’da `Yan sohbet` gösterilmez.
- `browser` veya `side-chat` tab contract’ı kodlanmaz.
- Gerçek embedded browser ayrı PRD/task gerektirir.

## Uygulama Planı

### Faz 1: Store ve Shell

- `right-workspace` store ekle.
- Tab modeli ve actions yaz.
- `RightWorkspace` shell, header ve boş panel launcher oluştur.
- Launcher satırları için i18n copy ekle.
- Typecheck.

### Faz 2: Files PreviewSurface Entegrasyonu

- Internal URL/artifact/file açma yollarını `openRightWorkspaceTab(kind: 'files')` ile değiştir.
- Mevcut `ChatPreviewRail` / `PreviewPane` davranışını `PreviewSurface` adaptörü altında çalıştır.
- `Files` target state, `treeVisible` ve `richPreviewEnabled` state’lerini ekle.
- Header path, open action ve overflow menu aksiyonlarını bağla.
- Artifacts route ve chat route üzerinde doğrula.

### Faz 3: Files Entegrasyonu

- Files launcher/tab ekle.
- `mainWithTree` layout adaptörü ekle.
- Mevcut file browser/tree UI’ını `TreeColumn` içine taşı veya adaptörle sar.
- Dosya seçimi `Files` target’ını güncelleyerek ana alanda mevcut preview renderer ile gösterilecek şekilde tasarla.
- Tree filtre, selected state, `treeVisible`, `richPreviewEnabled`, breadcrumb ve empty state davranışını koru.

### Faz 4: Terminal Entegrasyonu

- Terminal tab adaptörü ekle.
- Mevcut `TerminalPaneChrome` / `TerminalSlot` host edilir.
- `PersistentTerminal`, `TerminalWorkspace`, `TerminalRail`, terminal store ve PTY lifecycle değiştirilmez.
- Terminal tab değişiminde unmount/process reset olmadığı doğrulanır.
- Eski terminal sidebar/takeover gate’leri shell’e yönlendirilir; terminal iç mimarisi refactor edilmez.

### Faz 5: Review Entegrasyonu

- Review tab adaptörü ekle.
- Existing review list/diff/stage actions korunur.
- Review changed-files tree `TreeColumn` yardımcı kolonuna yerleşir.
- Review tree için `treeVisible` state’i ekle.
- Staged/unstaged dropdown, changed count ve +added/-removed sayıları header/context toolbar’a taşınır.
- Overflow menü görünüm/kopyalama aksiyonlarını bağla.
- Dosyaya git palette’ini changed file list ile bağla.
- Unified/split, word wrap, word diff, whitespace ve rich preview state’lerini review tab state’inde tut.
- PR butonunu `gh` varlığına göre enabled/disabled göster.

### Faz 6: Eski Gate Temizliği



- `DesktopController` içindeki feature-specific sağ panel koşulları kaldırılır.
- Eski right-sidebar imports sadece adaptörler üzerinden kalır.
- Duplicate width/open/focus state temizlenir.
- UI snapshot/manual smoke yapılır.

## Test Kararları

- Store unit testleri davranış odaklı yazılmalı:
  - review singleton açılır
  - boş Files tab singleton kalır
  - aynı kind/target açıldığında tab reuse
  - internal URL/artifact/file açma `files` tab target’ını günceller
  - yeni target açıldığında doğru aktif tab
  - close panel tab state’i silmez
  - close tab active fallback seçer
- Component testleri mümkünse launcher ve tab switch davranışını doğrulamalı.
- Terminal için process lifecycle testleri mock snapshot değil invariant olmalı:
  - tab değişimi terminal session id değiştirmez
  - panel close session dispose çağırmaz
  - terminal tab pasifleşince `PersistentTerminal` lifecycle bozulmaz
- Review için mevcut git IPC testleri yeniden kullanılmalı; yeni test yalnızca workspace action wiring’i ve tree toggle state’ini doğrulamalı.
- Manual smoke:
  - Artifacts → Preview
  - Sağ panel boş → Launcher
  - Header `+` → Yeni tab menüsü
  - Review açıkken `+` menüsünde İncele gizli/focus davranışı
  - Boş Dosya aç tabı duplicate oluşturmaz
  - Tab hover → close icon
  - Launcher → Files
  - Launcher → Terminal
  - Launcher → Review
  - Files boş açılış empty state
  - Files internal URL/artifact açma
  - Files breadcrumb güncelleme
  - Files tree göster/gizle
  - Files overflow menüsü
  - Files rich preview aç/kapat
  - Review tree göster/gizle
  - Review dosyaya git palette
  - Review unified/split diff toggle
  - Review overflow görünüm ayarları
  - PR butonu gh yokken disabled tooltip
  - Browser ve Yan sohbet launcher’da görünmez
  - Panel close/open → state korunur
  - Dar pencere → overlay/takeover
  - Geniş pencere → split

## Başarı Metrikleri

- Artifact preview aynı route üzerinde anında açılır.
- Sağ panelde açık olan yüzey her zaman header tab’ında görünür.
- Preview, Files, Terminal ve Review arasında geçiş state kaybetmez.
- `DesktopController` sağ panel kararları azalır; feature-specific koşullar shell/adaptörlere taşınır.
- Yeni core tool, backend schema veya dashboard bağımlılığı eklenmez.
- `npm run typecheck` geçer.
- Windows packaged app içinde temel sağ workspace smoke testi geçer.

## Riskler ve Önlemler

- Risk: Terminal unmount process resetleyebilir.
  - Önlem: Terminal tab içeriği persistent terminal mekanizmasını kullanmalı; tab switch CSS visibility veya persistent slot üzerinden yapılmalı.
- Risk: Terminal normal React child gibi taşınırsa PTY/xterm lifecycle bozulabilir.
  - Önlem: Terminal yalnızca existing `PersistentTerminal` slot mimarisiyle host edilmeli; terminal store ve rail taşınmamalı.
- Risk: Preview ve Files aynı target state’ini farklı yorumlayabilir.
  - Önlem: Tab modelinde `kind` ve `target` ayrımı zorunlu olmalı.
- Risk: `DesktopController` refactor büyük diff üretebilir.
  - Önlem: Adaptör fazlarıyla ilerle, eski bileşenleri önce sar, sonra gate temizle.
- Risk: Review tree ve Files tree duplicate görsel dil yaratır.
  - Önlem: Ortak tree row primitive veya shared style token kullanılmalı.

## Açık Sorular

- Yok. İlk sürüm kararları kapatıldı.

## Varsayımlar

- İlk uygulama desktop-only olacak.
- Browser gerçek webview entegrasyonu bu PRD’nin ilk uygulama kapsamına alınmayacak ve placeholder da yapılmayacak.
- Remote artifact cache/download PRD’si ayrı kalacak; bu PRD sadece sağ workspace shell ve mevcut yüzeylerin birleşimini kapsar. Files, artifact ve internal URL preview mevcut preview renderer ile çalışır.
- Codex app görselleri ürün referansı olarak kullanılacak; birebir kopya değil, Hermes mimarisine uyarlanmış benzer davranış hedeflenecek.
