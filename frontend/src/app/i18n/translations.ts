export type Translations = {
  heroLine1: string
  heroLine2: string
  heroSubtitle: string
  uploadKicker: string
  uploadTitle: string
  uploadSubtitle: string
  uploadChoose: string
  uploadMaxSize: string
  uploadTip: string
  hintLabel: string
  hintOptional: string
  hintPlaceholder: string
  runSearch: string
  runningSearch: string
  uploadAtLeastOne: string
  howItWorksPipeline: string
  howItWorksTitle: string
  steps: { title: string; desc: string }[]
  serviceTitle: string
  serviceBody: string
  serviceTags: string[]
  arrowHowItWorks: string
  arrowServiceIntro: string
}

const ko: Translations = {
  heroLine1: '사진을 보여주세요.',
  heroLine2: '어디서 찍었는지 찾아드릴게요.',
  heroSubtitle: '여행 사진을 업로드하면 랜드마크 감지, 비주얼 AI, GPS 메타데이터로 위치를 정확하게 찾아냅니다. 그 다음 여행 일지 작성을 도와드립니다.',
  uploadKicker: '사진 업로드',
  uploadTitle: '여기에 사진을 드롭하세요',
  uploadSubtitle: '또는 클릭해서 기기에서 파일을 선택하세요',
  uploadChoose: '이미지 선택',
  uploadMaxSize: '이미지당 최대 30MB.',
  uploadTip: '팁: 같은 여행에서 찍은 사진 여러 장을 올리면 정확도가 높아집니다.',
  hintLabel: '// AI 힌트',
  hintOptional: '선택',
  hintPlaceholder: '예: 2023년 여름 일본 여행, 암스테르담 운하 근처 카페 거리...',
  runSearch: '검색 실행',
  runningSearch: '검색 중...',
  uploadAtLeastOne: '검색을 실행하기 전에 여행 사진을 최소 한 장 업로드하세요.',
  howItWorksPipeline: 'Pipeline',
  howItWorksTitle: '여행 사진 파인더 작동 방식',
  steps: [
    { title: '사진 업로드', desc: '여행 사진을 한 장 또는 여러 장 업로드합니다. 같은 여행에서 찍은 사진 여러 장을 올리면 위치 정확도가 높아집니다.' },
    { title: 'EXIF GPS 즉시 감지', desc: '사진에 GPS 데이터가 내장되어 있으면 바로 좌표를 추출합니다. 추가 분석 없이 즉시 결과를 제공합니다.' },
    { title: '랜드마크 & OCR 인식', desc: 'Google Vision AI로 유명 건축물, 명소, 간판 텍스트를 식별합니다. 표지판에서 장소 이름을 직접 읽어냅니다.' },
    { title: '비주얼 AI 분석', desc: 'GPT-4 Vision이 건물 양식, 지형지물, 분위기 등을 분석해 이미지만으로 위치를 추론합니다.' },
    { title: '위치 후보 도출', desc: '여러 신호를 결합하고 신뢰도 점수를 계산합니다. 가장 가능성 높은 후보부터 순서대로 제시합니다.' },
    { title: '여행 일지 자동 생성', desc: '위치가 확인되면 AI가 여행 기록과 Travel DNA를 자동으로 작성합니다. 나만의 여행 패턴을 분석해 드립니다.' },
  ],
  serviceTitle: '이곳은 어디인가요?',
  serviceBody: '사진을 보며 "여기 어디지?"라고 궁금했다면, 이미지를 업로드하세요. GPS 메타데이터, 랜드마크 인식, 비주얼 AI를 결합한 다단계 파이프라인이 정확한 위치를 찾아냅니다. 여행 사진, SNS 스크린샷, 엽서, 영화 스틸 등 어디에나 사용할 수 있습니다. 위치가 확인되면 여행 일지와 Travel DNA까지 자동으로 만들어 드립니다.',
  serviceTags: ['GPS 메타데이터', '랜드마크 인식', '비주얼 AI', '자동 여행 일지', 'Travel DNA'],
  arrowHowItWorks: '작동 방식',
  arrowServiceIntro: '우리는?',
}

const en: Translations = {
  heroLine1: 'Show us a photo.',
  heroLine2: "We'll find where you've been.",
  heroSubtitle: 'Upload any travel photo — we pinpoint the location using landmark detection, visual AI, and GPS metadata. Then we help you build a travel journal.',
  uploadKicker: 'Photo upload',
  uploadTitle: 'Drop your photo here',
  uploadSubtitle: 'or click to browse from your device',
  uploadChoose: 'Choose images',
  uploadMaxSize: 'Up to 30MB per image.',
  uploadTip: 'Tip: uploading multiple photos from the same trip noticeably improves accuracy.',
  hintLabel: '// Hint for AI',
  hintOptional: 'optional',
  hintPlaceholder: 'e.g. Shot in Japan in summer 2023, near a canal in Amsterdam, café district...',
  runSearch: 'Run search',
  runningSearch: 'Running search...',
  uploadAtLeastOne: 'Upload at least one travel image before running the image search.',
  howItWorksPipeline: 'Pipeline',
  howItWorksTitle: 'How the Travel Photo Finder Works',
  steps: [
    { title: 'Upload Photo', desc: 'Upload one or more travel photos. Multiple photos from the same trip significantly improve location accuracy.' },
    { title: 'EXIF GPS Detection', desc: 'If your photo contains embedded GPS data, coordinates are extracted instantly — no further analysis needed.' },
    { title: 'Landmark & OCR Recognition', desc: 'Google Vision AI identifies famous buildings, landmarks, and text from signs and notices in the image.' },
    { title: 'Visual AI Analysis', desc: 'GPT-4 Vision analyzes architectural style, terrain, and atmosphere to infer location from the image alone.' },
    { title: 'Location Candidates', desc: 'Multiple signals are combined and confidence scores are computed. Results are ranked from most to least likely.' },
    { title: 'Auto Travel Journal', desc: 'Once a location is confirmed, AI automatically writes your travel record and builds your Travel DNA profile.' },
  ],
  serviceTitle: 'Where was this taken?',
  serviceBody: 'Ever looked at a photo and wondered "Where exactly is this?" — just upload it. Our multi-tier pipeline combines GPS metadata, landmark recognition, and visual AI to pinpoint the location. Works with travel photos, social media screenshots, postcards, movie stills, and more. Once found, your travel journal and Travel DNA are built automatically.',
  serviceTags: ['GPS Metadata', 'Landmark Recognition', 'Visual AI', 'Auto Journal', 'Travel DNA'],
  arrowHowItWorks: 'How it works',
  arrowServiceIntro: 'About us',
}

const ja: Translations = {
  heroLine1: '写真を見せてください。',
  heroLine2: 'どこで撮ったか、見つけてあげます。',
  heroSubtitle: '旅行写真をアップロードすると、ランドマーク検出・ビジュアルAI・GPSメタデータで場所を特定します。その後、旅行日記の作成もお手伝いします。',
  uploadKicker: '写真アップロード',
  uploadTitle: 'ここに写真をドロップ',
  uploadSubtitle: 'またはクリックしてデバイスから選択',
  uploadChoose: '画像を選択',
  uploadMaxSize: '1枚あたり最大30MB。',
  uploadTip: 'ヒント：同じ旅行の写真を複数枚アップロードすると精度が上がります。',
  hintLabel: '// AIへのヒント',
  hintOptional: '任意',
  hintPlaceholder: '例：2023年夏の日本旅行、アムステルダムの運河近くのカフェ街...',
  runSearch: '検索を実行',
  runningSearch: '検索中...',
  uploadAtLeastOne: '検索を実行する前に旅行写真を少なくとも1枚アップロードしてください。',
  howItWorksPipeline: 'Pipeline',
  howItWorksTitle: 'トラベルフォトファインダーの仕組み',
  steps: [
    { title: '写真アップロード', desc: '旅行写真を1枚または複数枚アップロードします。同じ旅行の写真を複数枚使うと位置精度が向上します。' },
    { title: 'EXIF GPS即時検出', desc: '写真にGPSデータが埋め込まれていれば、すぐに座標を抽出します。追加分析なしで即結果が得られます。' },
    { title: 'ランドマーク＆OCR認識', desc: 'Google Vision AIで有名建築物、名所、看板のテキストを識別します。標識から直接場所名を読み取ります。' },
    { title: 'ビジュアルAI分析', desc: 'GPT-4 Visionが建物の様式、地形、雰囲気を分析し、画像だけで場所を推定します。' },
    { title: '位置候補の導出', desc: '複数のシグナルを統合して信頼度スコアを計算します。最も可能性が高い候補から順に表示されます。' },
    { title: '旅行日記の自動生成', desc: '場所が確定したら、AIが旅行記録とTravel DNAを自動で作成します。あなただけの旅パターンを分析します。' },
  ],
  serviceTitle: 'ここはどこですか？',
  serviceBody: '写真を見て「ここどこだっけ？」と思ったら、アップロードしてください。GPSメタデータ・ランドマーク認識・ビジュアルAIを組み合わせた多段階パイプラインが正確な場所を見つけ出します。旅行写真、SNSスクリーンショット、絵葉書、映画のスチールなど何にでも使えます。場所が確認されたら、旅行日記とTravel DNAも自動で作成されます。',
  serviceTags: ['GPSメタデータ', 'ランドマーク認識', 'ビジュアルAI', '自動旅行日記', 'Travel DNA'],
  arrowHowItWorks: '仕組み',
  arrowServiceIntro: 'サービス紹介',
}

const zh: Translations = {
  heroLine1: '请上传您的照片。',
  heroLine2: '我们将为您找到拍摄地点。',
  heroSubtitle: '上传任意旅行照片——我们通过地标检测、视觉AI和GPS元数据精确定位。然后帮您建立旅行日记。',
  uploadKicker: '照片上传',
  uploadTitle: '将照片拖放到此处',
  uploadSubtitle: '或点击从您的设备中浏览',
  uploadChoose: '选择图片',
  uploadMaxSize: '每张图片最大30MB。',
  uploadTip: '提示：上传同一次旅行的多张照片可以明显提高定位精度。',
  hintLabel: '// AI提示',
  hintOptional: '可选',
  hintPlaceholder: '例如：2023年夏天在日本拍摄，阿姆斯特丹运河附近的咖啡街...',
  runSearch: '开始搜索',
  runningSearch: '搜索中...',
  uploadAtLeastOne: '请在运行搜索之前至少上传一张旅行照片。',
  howItWorksPipeline: 'Pipeline',
  howItWorksTitle: '旅行照片查找器工作原理',
  steps: [
    { title: '上传照片', desc: '上传一张或多张旅行照片。上传同一次旅行的多张照片可以显著提高位置准确性。' },
    { title: 'EXIF GPS即时检测', desc: '如果照片中嵌入了GPS数据，系统会立即提取坐标，无需额外分析即可获得结果。' },
    { title: '地标与OCR识别', desc: 'Google Vision AI识别著名建筑、名胜古迹和照片中标牌上的文字，直接读取地点名称。' },
    { title: '视觉AI分析', desc: 'GPT-4 Vision分析建筑风格、地形地貌和氛围，仅凭图像即可推断位置。' },
    { title: '位置候选推导', desc: '整合多个信号并计算置信度分数，按可能性从高到低排列候选结果。' },
    { title: '自动生成旅行日记', desc: '位置确认后，AI自动生成旅行记录和Travel DNA，分析您的个人旅行模式。' },
  ],
  serviceTitle: '这是哪里？',
  serviceBody: '看着照片却想不起"这是在哪里拍的"？只需上传照片，我们结合GPS元数据、地标识别和视觉AI的多层管道将精确定位地点。适用于旅行照片、社交媒体截图、明信片、电影剧照等。找到位置后，旅行日记和Travel DNA将自动生成。',
  serviceTags: ['GPS元数据', '地标识别', '视觉AI', '自动旅行日记', 'Travel DNA'],
  arrowHowItWorks: '运作方式',
  arrowServiceIntro: '关于我们',
}

const es: Translations = {
  heroLine1: 'Muéstranos una foto.',
  heroLine2: 'Encontraremos dónde estuviste.',
  heroSubtitle: 'Sube cualquier foto de viaje — determinamos la ubicación con detección de monumentos, IA visual y metadatos GPS. Luego te ayudamos a crear un diario de viaje.',
  uploadKicker: 'Subir foto',
  uploadTitle: 'Arrastra tu foto aquí',
  uploadSubtitle: 'o haz clic para buscar en tu dispositivo',
  uploadChoose: 'Elegir imágenes',
  uploadMaxSize: 'Hasta 30MB por imagen.',
  uploadTip: 'Consejo: subir varias fotos del mismo viaje mejora notablemente la precisión.',
  hintLabel: '// Pista para IA',
  hintOptional: 'opcional',
  hintPlaceholder: 'Ej: Foto tomada en Japón en verano de 2023, cerca de un canal en Ámsterdam...',
  runSearch: 'Buscar',
  runningSearch: 'Buscando...',
  uploadAtLeastOne: 'Sube al menos una foto de viaje antes de ejecutar la búsqueda.',
  howItWorksPipeline: 'Pipeline',
  howItWorksTitle: 'Cómo funciona el buscador de fotos de viaje',
  steps: [
    { title: 'Subir foto', desc: 'Sube una o varias fotos de viaje. Varias fotos del mismo viaje mejoran considerablemente la precisión de ubicación.' },
    { title: 'Detección GPS EXIF', desc: 'Si la foto tiene datos GPS incrustados, se extraen las coordenadas al instante, sin análisis adicional.' },
    { title: 'Reconocimiento de monumentos y OCR', desc: 'Google Vision AI identifica edificios famosos, monumentos y texto de carteles en la imagen.' },
    { title: 'Análisis de IA visual', desc: 'GPT-4 Vision analiza el estilo arquitectónico, el terreno y el ambiente para inferir la ubicación solo con la imagen.' },
    { title: 'Candidatos de ubicación', desc: 'Se combinan múltiples señales y se calculan puntuaciones de confianza. Los resultados se ordenan de mayor a menor probabilidad.' },
    { title: 'Diario de viaje automático', desc: 'Una vez confirmada la ubicación, la IA genera automáticamente tu registro de viaje y tu Travel DNA.' },
  ],
  serviceTitle: '¿Dónde fue tomada esta foto?',
  serviceBody: '¿Ves una foto y te preguntas "¿dónde es esto exactamente?"? Solo súbela. Nuestro pipeline combina metadatos GPS, reconocimiento de monumentos e IA visual para ubicarla con precisión. Funciona con fotos de viaje, capturas de redes sociales, postales, fotogramas de películas y más. Una vez encontrada la ubicación, tu diario de viaje y Travel DNA se crean automáticamente.',
  serviceTags: ['Metadatos GPS', 'Reconocimiento de monumentos', 'IA Visual', 'Diario automático', 'Travel DNA'],
  arrowHowItWorks: 'Cómo funciona',
  arrowServiceIntro: '¿Quiénes somos?',
}

const fr: Translations = {
  heroLine1: 'Montrez-nous une photo.',
  heroLine2: 'Nous trouverons où vous étiez.',
  heroSubtitle: "Téléchargez n'importe quelle photo de voyage — nous localisons l'endroit grâce à la détection de monuments, à l'IA visuelle et aux métadonnées GPS. Nous vous aidons ensuite à créer un journal de voyage.",
  uploadKicker: 'Télécharger une photo',
  uploadTitle: 'Déposez votre photo ici',
  uploadSubtitle: 'ou cliquez pour parcourir vos fichiers',
  uploadChoose: 'Choisir des images',
  uploadMaxSize: "Jusqu'à 30 Mo par image.",
  uploadTip: 'Astuce : télécharger plusieurs photos du même voyage améliore nettement la précision.',
  hintLabel: "// Indice pour l'IA",
  hintOptional: 'optionnel',
  hintPlaceholder: "Ex : Photo prise au Japon en été 2023, près d'un canal à Amsterdam...",
  runSearch: 'Lancer la recherche',
  runningSearch: 'Recherche en cours...',
  uploadAtLeastOne: 'Veuillez télécharger au moins une photo de voyage avant de lancer la recherche.',
  howItWorksPipeline: 'Pipeline',
  howItWorksTitle: 'Comment fonctionne le localisateur de photos',
  steps: [
    { title: 'Télécharger la photo', desc: 'Téléchargez une ou plusieurs photos de voyage. Plusieurs photos du même voyage améliorent considérablement la précision.' },
    { title: 'Détection GPS EXIF', desc: "Si la photo contient des données GPS intégrées, les coordonnées sont extraites instantanément, sans analyse supplémentaire." },
    { title: 'Reconnaissance de monuments et OCR', desc: "Google Vision AI identifie les bâtiments célèbres, les sites touristiques et le texte des panneaux dans l'image." },
    { title: "Analyse par IA visuelle", desc: "GPT-4 Vision analyse le style architectural, le terrain et l'atmosphère pour déduire la localisation uniquement à partir de l'image." },
    { title: 'Candidats de localisation', desc: 'Plusieurs signaux sont combinés et des scores de confiance sont calculés. Les résultats sont classés du plus au moins probable.' },
    { title: 'Journal de voyage automatique', desc: "Une fois l'emplacement confirmé, l'IA génère automatiquement votre carnet de voyage et votre Travel DNA." },
  ],
  serviceTitle: 'Où a été prise cette photo ?',
  serviceBody: "Vous regardez une photo et vous vous demandez « Mais où est-ce exactement ? » — il suffit de la télécharger. Notre pipeline combine métadonnées GPS, reconnaissance de monuments et IA visuelle pour localiser précisément le lieu. Fonctionne avec des photos de voyage, des captures d'écran de réseaux sociaux, des cartes postales, des images de films et bien plus. Une fois le lieu trouvé, votre journal de voyage et votre Travel DNA sont créés automatiquement.",
  serviceTags: ['Métadonnées GPS', 'Reconnaissance de monuments', 'IA Visuelle', 'Journal automatique', 'Travel DNA'],
  arrowHowItWorks: 'Comment ça marche',
  arrowServiceIntro: 'Qui sommes-nous ?',
}

const de: Translations = {
  heroLine1: 'Zeigen Sie uns ein Foto.',
  heroLine2: 'Wir finden heraus, wo Sie waren.',
  heroSubtitle: 'Laden Sie ein beliebiges Reisefoto hoch — wir bestimmen den Ort mithilfe von Wahrzeichen-Erkennung, visueller KI und GPS-Metadaten. Dann helfen wir Ihnen, ein Reisetagebuch zu erstellen.',
  uploadKicker: 'Foto hochladen',
  uploadTitle: 'Foto hier ablegen',
  uploadSubtitle: 'oder klicken, um vom Gerät zu durchsuchen',
  uploadChoose: 'Bilder auswählen',
  uploadMaxSize: 'Bis zu 30 MB pro Bild.',
  uploadTip: 'Tipp: Mehrere Fotos derselben Reise hochzuladen verbessert die Genauigkeit deutlich.',
  hintLabel: '// Hinweis für KI',
  hintOptional: 'optional',
  hintPlaceholder: 'z.B. Foto aus Japan im Sommer 2023, in der Nähe eines Kanals in Amsterdam...',
  runSearch: 'Suche starten',
  runningSearch: 'Suche läuft...',
  uploadAtLeastOne: 'Bitte laden Sie mindestens ein Reisefoto hoch, bevor Sie die Suche starten.',
  howItWorksPipeline: 'Pipeline',
  howItWorksTitle: 'So funktioniert der Reisefoto-Finder',
  steps: [
    { title: 'Foto hochladen', desc: 'Laden Sie ein oder mehrere Reisefotos hoch. Mehrere Fotos derselben Reise verbessern die Standortgenauigkeit erheblich.' },
    { title: 'EXIF-GPS-Erkennung', desc: 'Wenn das Foto eingebettete GPS-Daten enthält, werden die Koordinaten sofort extrahiert — keine weitere Analyse nötig.' },
    { title: 'Wahrzeichen- & OCR-Erkennung', desc: 'Google Vision AI erkennt berühmte Gebäude, Sehenswürdigkeiten und Texte auf Schildern im Bild.' },
    { title: 'Visuelle KI-Analyse', desc: 'GPT-4 Vision analysiert Architekturstil, Gelände und Atmosphäre, um den Ort allein aus dem Bild zu erschließen.' },
    { title: 'Standortkandidaten', desc: 'Mehrere Signale werden kombiniert und Konfidenzwerte berechnet. Die Ergebnisse werden nach Wahrscheinlichkeit geordnet.' },
    { title: 'Automatisches Reisetagebuch', desc: 'Sobald der Standort bestätigt ist, erstellt die KI automatisch Ihren Reisebericht und Ihre Travel DNA.' },
  ],
  serviceTitle: 'Wo wurde dieses Foto aufgenommen?',
  serviceBody: 'Sie sehen ein Foto und fragen sich „Wo genau ist das?" — laden Sie es einfach hoch. Unsere mehrstufige Pipeline kombiniert GPS-Metadaten, Wahrzeichen-Erkennung und visuelle KI, um den Ort genau zu bestimmen. Funktioniert mit Reisefotos, Social-Media-Screenshots, Postkarten, Filmstills und mehr. Sobald der Ort gefunden ist, werden Ihr Reisetagebuch und Ihre Travel DNA automatisch erstellt.',
  serviceTags: ['GPS-Metadaten', 'Wahrzeichen-Erkennung', 'Visuelle KI', 'Auto-Tagebuch', 'Travel DNA'],
  arrowHowItWorks: 'So funktioniert es',
  arrowServiceIntro: 'Über uns',
}

const pt: Translations = {
  heroLine1: 'Mostre-nos uma foto.',
  heroLine2: 'Descobriremos onde você esteve.',
  heroSubtitle: 'Envie qualquer foto de viagem — identificamos o local usando detecção de pontos turísticos, IA visual e metadados GPS. Depois, ajudamos você a criar um diário de viagem.',
  uploadKicker: 'Enviar foto',
  uploadTitle: 'Arraste sua foto aqui',
  uploadSubtitle: 'ou clique para procurar no seu dispositivo',
  uploadChoose: 'Escolher imagens',
  uploadMaxSize: 'Até 30MB por imagem.',
  uploadTip: 'Dica: enviar várias fotos da mesma viagem melhora notavelmente a precisão.',
  hintLabel: '// Dica para IA',
  hintOptional: 'opcional',
  hintPlaceholder: 'Ex: Foto tirada no Japão no verão de 2023, perto de um canal em Amsterdã...',
  runSearch: 'Iniciar busca',
  runningSearch: 'Buscando...',
  uploadAtLeastOne: 'Envie pelo menos uma foto de viagem antes de iniciar a busca.',
  howItWorksPipeline: 'Pipeline',
  howItWorksTitle: 'Como funciona o localizador de fotos de viagem',
  steps: [
    { title: 'Enviar foto', desc: 'Envie uma ou mais fotos de viagem. Várias fotos da mesma viagem melhoram consideravelmente a precisão da localização.' },
    { title: 'Detecção GPS EXIF', desc: 'Se a foto contiver dados GPS incorporados, as coordenadas são extraídas instantaneamente, sem análise adicional.' },
    { title: 'Reconhecimento de pontos turísticos e OCR', desc: 'O Google Vision AI identifica edifícios famosos, pontos turísticos e texto em placas na imagem.' },
    { title: 'Análise por IA visual', desc: 'O GPT-4 Vision analisa o estilo arquitetônico, terreno e atmosfera para inferir a localização apenas a partir da imagem.' },
    { title: 'Candidatos de localização', desc: 'Múltiplos sinais são combinados e pontuações de confiança são calculadas. Os resultados são ordenados do mais ao menos provável.' },
    { title: 'Diário de viagem automático', desc: 'Assim que a localização é confirmada, a IA gera automaticamente seu registro de viagem e seu Travel DNA.' },
  ],
  serviceTitle: 'Onde esta foto foi tirada?',
  serviceBody: 'Viu uma foto e se perguntou "Onde fica isso exatamente?" — basta enviá-la. Nosso pipeline combina metadados GPS, reconhecimento de pontos turísticos e IA visual para localizar o lugar com precisão. Funciona com fotos de viagem, capturas de tela de redes sociais, cartões-postais, fotogramas de filmes e muito mais. Depois de encontrado o local, seu diário de viagem e Travel DNA são criados automaticamente.',
  serviceTags: ['Metadados GPS', 'Reconhecimento de pontos turísticos', 'IA Visual', 'Diário automático', 'Travel DNA'],
  arrowHowItWorks: 'Como funciona',
  arrowServiceIntro: 'Sobre nós',
}

const it: Translations = {
  heroLine1: 'Mostraci una foto.',
  heroLine2: 'Troveremo dove sei stato/a.',
  heroSubtitle: 'Carica qualsiasi foto di viaggio — individuiamo il luogo usando il riconoscimento di monumenti, la visione artificiale e i metadati GPS. Poi ti aiutiamo a creare un diario di viaggio.',
  uploadKicker: 'Carica foto',
  uploadTitle: 'Trascina la tua foto qui',
  uploadSubtitle: 'oppure clicca per sfogliare dal dispositivo',
  uploadChoose: 'Scegli immagini',
  uploadMaxSize: 'Fino a 30MB per immagine.',
  uploadTip: 'Suggerimento: caricare più foto dello stesso viaggio migliora notevolmente la precisione.',
  hintLabel: '// Suggerimento per AI',
  hintOptional: 'opzionale',
  hintPlaceholder: 'Es: Foto scattata in Giappone estate 2023, vicino a un canale ad Amsterdam...',
  runSearch: 'Avvia ricerca',
  runningSearch: 'Ricerca in corso...',
  uploadAtLeastOne: "Carica almeno una foto di viaggio prima di avviare la ricerca.",
  howItWorksPipeline: 'Pipeline',
  howItWorksTitle: 'Come funziona il localizzatore di foto di viaggio',
  steps: [
    { title: 'Carica foto', desc: 'Carica una o più foto di viaggio. Più foto dello stesso viaggio migliorano considerevolmente la precisione.' },
    { title: 'Rilevamento GPS EXIF', desc: 'Se la foto contiene dati GPS incorporati, le coordinate vengono estratte istantaneamente, senza ulteriori analisi.' },
    { title: 'Riconoscimento monumenti e OCR', desc: "Google Vision AI identifica edifici famosi, luoghi di interesse e testo sui cartelli nell'immagine." },
    { title: 'Analisi IA visiva', desc: "GPT-4 Vision analizza lo stile architettonico, il terreno e l'atmosfera per dedurre la posizione solo dall'immagine." },
    { title: 'Candidati di posizione', desc: 'Più segnali vengono combinati e vengono calcolati punteggi di confidenza. I risultati vengono ordinati dal più al meno probabile.' },
    { title: 'Diario di viaggio automatico', desc: "Una volta confermata la posizione, l'AI genera automaticamente il tuo registro di viaggio e il tuo Travel DNA." },
  ],
  serviceTitle: 'Dove è stata scattata questa foto?',
  serviceBody: 'Hai visto una foto e ti sei chiesto "Ma dove si trova esattamente?" — caricala e basta. La nostra pipeline combina metadati GPS, riconoscimento di monumenti e IA visiva per localizzare il posto con precisione. Funziona con foto di viaggio, screenshot dai social, cartoline, fotogrammi di film e altro ancora. Una volta trovato il luogo, il tuo diario di viaggio e il tuo Travel DNA vengono creati automaticamente.',
  serviceTags: ['Metadati GPS', 'Riconoscimento monumenti', 'IA Visiva', 'Diario automatico', 'Travel DNA'],
  arrowHowItWorks: 'Come funziona',
  arrowServiceIntro: 'Chi siamo',
}

const ru: Translations = {
  heroLine1: 'Покажите нам фото.',
  heroLine2: 'Мы найдём, где вы были.',
  heroSubtitle: 'Загрузите любое фото из путешествия — мы определим место с помощью распознавания достопримечательностей, визуального ИИ и GPS-метаданных. Затем поможем создать дневник путешествий.',
  uploadKicker: 'Загрузить фото',
  uploadTitle: 'Перетащите фото сюда',
  uploadSubtitle: 'или нажмите, чтобы выбрать файл',
  uploadChoose: 'Выбрать изображения',
  uploadMaxSize: 'До 30 МБ на изображение.',
  uploadTip: 'Совет: загрузка нескольких фото из одной поездки значительно повышает точность.',
  hintLabel: '// Подсказка для ИИ',
  hintOptional: 'необязательно',
  hintPlaceholder: 'Напр.: Фото из Японии летом 2023, рядом с каналом в Амстердаме...',
  runSearch: 'Начать поиск',
  runningSearch: 'Поиск...',
  uploadAtLeastOne: 'Загрузите хотя бы одно фото из путешествия перед началом поиска.',
  howItWorksPipeline: 'Pipeline',
  howItWorksTitle: 'Как работает поиск по фото',
  steps: [
    { title: 'Загрузка фото', desc: 'Загрузите одно или несколько фото из путешествия. Несколько фото из одной поездки значительно улучшают точность определения места.' },
    { title: 'Мгновенное определение GPS', desc: 'Если в фото встроены GPS-данные, координаты извлекаются мгновенно — без дополнительного анализа.' },
    { title: 'Распознавание достопримечательностей и OCR', desc: 'Google Vision AI определяет известные здания, достопримечательности и текст на вывесках на изображении.' },
    { title: 'Анализ визуальным ИИ', desc: 'GPT-4 Vision анализирует архитектурный стиль, рельеф и атмосферу, чтобы определить место только по изображению.' },
    { title: 'Кандидаты местоположения', desc: 'Несколько сигналов объединяются, вычисляются оценки уверенности. Результаты отсортированы от наиболее до наименее вероятного.' },
    { title: 'Автоматический дневник путешествий', desc: 'После подтверждения местоположения ИИ автоматически создаёт запись путешествия и ваш Travel DNA.' },
  ],
  serviceTitle: 'Где сделано это фото?',
  serviceBody: 'Смотрите на фото и думаете «Где же это снято?» — просто загрузите его. Наш многоуровневый конвейер объединяет GPS-метаданные, распознавание достопримечательностей и визуальный ИИ, чтобы точно определить место. Подходит для фото из путешествий, скриншотов из соцсетей, открыток, кадров из фильмов и многого другого. После нахождения места дневник путешествий и Travel DNA создаются автоматически.',
  serviceTags: ['GPS-метаданные', 'Распознавание достопримечательностей', 'Визуальный ИИ', 'Авто-дневник', 'Travel DNA'],
  arrowHowItWorks: 'Как это работает',
  arrowServiceIntro: 'О нас',
}

export const TRANSLATIONS: Record<string, Translations> = {
  ko, en, ja, zh, es, fr, de, pt, it, ru,
}

export function getTranslation(lang: string): Translations {
  return TRANSLATIONS[lang] ?? TRANSLATIONS.en
}
