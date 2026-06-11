/**
 * MEB müfredatı — ders + sınıf bazında ünite (konu) ve alt konu listeleri.
 * Ödev oluştururken öğretmen, seçtiği ders ve sınıfa göre panel tarzında
 * konu → alt konu seçer. Anahtarlar AssignmentFilterPanel'deki SUBJECTS
 * etiketleriyle birebir aynı olmalı.
 *
 * Liste temsilîdir; üst konu soru havuzundaki `topic`, alt konu `sub_topic`
 * alanıyla eşleştirilir. Eksik sınıf/ders kombinasyonu için panel manuel konu
 * eklemeye izin verir.
 */
export type CurriculumUnit = { topic: string; subTopics: string[] };
export type CurriculumMap = Record<string, Partial<Record<number, CurriculumUnit[]>>>;

export const MEB_CURRICULUM: CurriculumMap = {
  Matematik: {
    9: [
      { topic: 'Mantık', subTopics: ['Önermeler', 'Bileşik Önermeler', 'Niceleyiciler', 'Açık Önermeler'] },
      { topic: 'Kümeler', subTopics: ['Kümelerde Temel Kavramlar', 'Kümelerde İşlemler', 'Kartezyen Çarpım'] },
      { topic: 'Denklemler ve Eşitsizlikler', subTopics: ['Birinci Dereceden Denklemler', 'Birinci Dereceden Eşitsizlikler', 'Mutlak Değer'] },
      { topic: 'Üslü İfadeler', subTopics: ['Üslü Sayılar', 'Üslü Denklemler'] },
      { topic: 'Köklü İfadeler', subTopics: ['Kareköklü İfadeler', 'n. Dereceden Kök'] },
      { topic: 'Oran ve Orantı', subTopics: ['Oran', 'Doğru ve Ters Orantı'] },
      { topic: 'Üçgenler', subTopics: ['Üçgende Açılar', 'Üçgende Eşlik ve Benzerlik', 'Açıortay ve Kenarortay', 'Pisagor Bağıntısı'] },
      { topic: 'Veri, Sayma ve Olasılık', subTopics: ['Merkezî Eğilim Ölçüleri', 'Sayma', 'Basit Olayların Olasılığı'] },
    ],
    10: [
      { topic: 'Sayma ve Olasılık', subTopics: ['Sıralama ve Seçme', 'Permütasyon', 'Kombinasyon', 'Binom', 'Olasılık'] },
      { topic: 'Fonksiyonlar', subTopics: ['Fonksiyon Kavramı', 'Fonksiyon Türleri', 'Fonksiyonlarda İşlemler', 'Bileşke ve Ters Fonksiyon'] },
      { topic: 'Polinomlar', subTopics: ['Polinom Kavramı', 'Polinomlarda İşlemler', 'Çarpanlara Ayırma'] },
      { topic: 'İkinci Dereceden Denklemler', subTopics: ['Kökler ve Diskriminant', 'Kökler ile Katsayı İlişkisi'] },
      { topic: 'Dörtgenler ve Çokgenler', subTopics: ['Çokgenler', 'Özel Dörtgenler', 'Paralelkenar ve Eşkenar Dörtgen'] },
      { topic: 'Katı Cisimler', subTopics: ['Dik Prizma', 'Piramit', 'Koni ve Küre'] },
      { topic: 'Analitik Geometri', subTopics: ['Noktanın Analitiği', 'Doğrunun Analitiği'] },
    ],
    11: [
      { topic: 'Trigonometri', subTopics: ['Yönlü Açılar', 'Birim Çember', 'Trigonometrik Fonksiyonlar', 'Toplam-Fark Formülleri'] },
      { topic: 'Analitik Geometri', subTopics: ['Doğru Denklemi', 'İki Doğrunun Durumu', 'Nokta-Doğru Uzaklığı'] },
      { topic: 'Fonksiyonlarda Uygulamalar', subTopics: ['Fonksiyon Grafikleri', 'İkinci Dereceden Fonksiyonlar', 'Parabol'] },
      { topic: 'Denklem ve Eşitsizlik Sistemleri', subTopics: ['Doğrusal Denklem Sistemleri', 'İkinci Dereceden Eşitsizlikler'] },
      { topic: 'Çember ve Daire', subTopics: ['Çemberde Açılar', 'Çemberde Uzunluk', 'Dairede Alan'] },
      { topic: 'Uzay Geometri', subTopics: ['Katı Cisimlerde Hacim', 'Yüzey Alanları'] },
      { topic: 'Olasılık', subTopics: ['Koşullu Olasılık', 'Bağımlı-Bağımsız Olaylar'] },
    ],
    12: [
      { topic: 'Üstel ve Logaritmik Fonksiyonlar', subTopics: ['Üstel Fonksiyon', 'Logaritma Fonksiyonu', 'Logaritmik Denklemler'] },
      { topic: 'Diziler', subTopics: ['Dizi Kavramı', 'Aritmetik Dizi', 'Geometrik Dizi'] },
      { topic: 'Trigonometri', subTopics: ['Trigonometrik Denklemler', 'Ters Trigonometrik Fonksiyonlar'] },
      { topic: 'Türev', subTopics: ['Limit ve Süreklilik', 'Türev Kavramı', 'Türev Alma Kuralları', 'Türev Uygulamaları', 'Maksimum-Minimum'] },
      { topic: 'İntegral', subTopics: ['Belirsiz İntegral', 'Belirli İntegral', 'Alan Hesabı'] },
      { topic: 'Analitik Geometri (Çember)', subTopics: ['Çemberin Denklemi', 'Çember ve Doğru'] },
    ],
  },
  Fizik: {
    9: [
      { topic: 'Fizik Bilimine Giriş', subTopics: ['Fiziğin Uğraş Alanları', 'Fiziksel Nicelikler', 'Birim Sistemleri'] },
      { topic: 'Madde ve Özellikleri', subTopics: ['Kütle ve Hacim', 'Özkütle', 'Dayanıklılık', 'Adezyon-Kohezyon'] },
      { topic: 'Hareket ve Kuvvet', subTopics: ['Konum ve Yer Değiştirme', 'Sürat ve Hız', 'İvme', 'Newton Yasaları'] },
      { topic: 'Enerji', subTopics: ['İş ve Güç', 'Kinetik Enerji', 'Potansiyel Enerji', 'Enerji Korunumu'] },
      { topic: 'Isı ve Sıcaklık', subTopics: ['Sıcaklık ve Isı', 'Hal Değişimi', 'Isıl Genleşme'] },
      { topic: 'Elektrostatik', subTopics: ['Elektrik Yükü', 'Yüklü Cisimler', 'Coulomb Kuvveti'] },
    ],
    10: [
      { topic: 'Elektrik ve Manyetizma', subTopics: ['Elektrik Akımı', 'Direnç', 'Ohm Yasası', 'Manyetizma'] },
      { topic: 'Basınç ve Kaldırma Kuvveti', subTopics: ['Katı Basıncı', 'Sıvı Basıncı', 'Gaz Basıncı', 'Kaldırma Kuvveti'] },
      { topic: 'Dalgalar', subTopics: ['Dalga Kavramı', 'Su Dalgaları', 'Ses Dalgaları'] },
      { topic: 'Optik', subTopics: ['Işığın Yansıması', 'Aynalar', 'Işığın Kırılması', 'Mercekler'] },
    ],
    11: [
      { topic: 'Kuvvet ve Hareket', subTopics: ['Bağıl Hareket', 'Atışlar', 'Newton Hareket Yasaları'] },
      { topic: 'Vektörler', subTopics: ['Vektör Kavramı', 'Vektörlerde İşlemler'] },
      { topic: 'Tork ve Denge', subTopics: ['Tork', 'Dengede Cisimler', 'Ağırlık Merkezi'] },
      { topic: 'Basit Makineler', subTopics: ['Kaldıraçlar', 'Makaralar', 'Eğik Düzlem'] },
      { topic: 'Elektrik ve Manyetizma', subTopics: ['Elektriksel Potansiyel', 'Sığa', 'Manyetik Alan'] },
    ],
    12: [
      { topic: 'Çembersel Hareket', subTopics: ['Düzgün Çembersel Hareket', 'Merkezcil Kuvvet', 'Açısal Momentum'] },
      { topic: 'Basit Harmonik Hareket', subTopics: ['BHH Kavramı', 'Yay Sarkacı', 'Basit Sarkaç'] },
      { topic: 'Dalga Mekaniği', subTopics: ['Girişim', 'Kırınım', 'Doppler Olayı'] },
      { topic: 'Atom Fiziği', subTopics: ['Atom Modelleri', 'Enerji Seviyeleri'] },
      { topic: 'Modern Fizik', subTopics: ['Özel Görelilik', 'Fotoelektrik Olay', 'Compton Saçılması'] },
    ],
  },
  Kimya: {
    9: [
      { topic: 'Kimya Bilimi', subTopics: ['Kimyanın Tarihçesi', 'Simgeler ve Formüller', 'Güvenlik'] },
      { topic: 'Atom ve Periyodik Sistem', subTopics: ['Atomun Yapısı', 'Atom Modelleri', 'Periyodik Sistem'] },
      { topic: 'Kimyasal Türler Arası Etkileşimler', subTopics: ['Güçlü Etkileşimler', 'Zayıf Etkileşimler', 'Kimyasal Bağlar'] },
      { topic: 'Maddenin Halleri', subTopics: ['Katı-Sıvı-Gaz', 'Hal Değişimleri'] },
      { topic: 'Doğa ve Kimya', subTopics: ['Su ve Hayat', 'Çevre Kimyası'] },
    ],
    10: [
      { topic: 'Kimyanın Temel Kanunları', subTopics: ['Kütlenin Korunumu', 'Sabit Oranlar', 'Mol Kavramı'] },
      { topic: 'Karışımlar', subTopics: ['Homojen Karışımlar', 'Heterojen Karışımlar', 'Ayırma Yöntemleri'] },
      { topic: 'Asit, Baz ve Tuz', subTopics: ['Asitler ve Bazlar', 'pH Kavramı', 'Tuzlar'] },
      { topic: 'Kimya Her Yerde', subTopics: ['Temizlik Maddeleri', 'Polimerler'] },
    ],
    11: [
      { topic: 'Modern Atom Teorisi', subTopics: ['Kuantum Sayıları', 'Elektron Dizilimi', 'Periyodik Özellikler'] },
      { topic: 'Gazlar', subTopics: ['Gaz Yasaları', 'İdeal Gaz Denklemi', 'Kısmi Basınçlar'] },
      { topic: 'Sıvı Çözeltiler', subTopics: ['Çözünürlük', 'Derişim Birimleri', 'Koligatif Özellikler'] },
      { topic: 'Kimyasal Tepkimelerde Enerji', subTopics: ['Entalpi', 'Hess Yasası'] },
      { topic: 'Kimyasal Tepkimelerde Hız', subTopics: ['Tepkime Hızı', 'Hızı Etkileyen Faktörler'] },
      { topic: 'Kimyasal Denge', subTopics: ['Denge Sabiti', 'Le Chatelier İlkesi'] },
    ],
    12: [
      { topic: 'Kimya ve Elektrik', subTopics: ['Redoks Tepkimeleri', 'Elektrokimyasal Hücreler', 'Elektroliz'] },
      { topic: 'Karbon Kimyasına Giriş', subTopics: ['Hibritleşme', 'Karbon Bileşikleri'] },
      { topic: 'Organik Bileşikler', subTopics: ['Hidrokarbonlar', 'Alkoller', 'Karboksilik Asitler'] },
      { topic: 'Enerji Kaynakları', subTopics: ['Fosil Yakıtlar', 'Yenilenebilir Enerji'] },
    ],
  },
  Biyoloji: {
    9: [
      { topic: 'Yaşam Bilimi Biyoloji', subTopics: ['Canlıların Ortak Özellikleri', 'Canlıların Yapısındaki Moleküller', 'Organik-İnorganik Bileşikler'] },
      { topic: 'Hücre', subTopics: ['Hücre Teorisi', 'Hücre Organelleri', 'Madde Geçişleri'] },
      { topic: 'Canlılar Dünyası', subTopics: ['Canlıların Sınıflandırılması', 'Canlı Alemleri'] },
    ],
    10: [
      { topic: 'Hücre Bölünmeleri', subTopics: ['Mitoz', 'Mayoz', 'Eşeyli-Eşeysiz Üreme'] },
      { topic: 'Kalıtım', subTopics: ['Mendel Genetiği', 'Çaprazlamalar', 'Eşeye Bağlı Kalıtım'] },
      { topic: 'Ekosistem Ekolojisi', subTopics: ['Madde Döngüleri', 'Enerji Akışı', 'Komünite'] },
      { topic: 'Güncel Çevre Sorunları', subTopics: ['Çevre Kirliliği', 'Sürdürülebilirlik'] },
    ],
    11: [
      { topic: 'Sinir Sistemi', subTopics: ['Nöron Yapısı', 'Merkezi Sinir Sistemi', 'Refleksler'] },
      { topic: 'Endokrin Sistem', subTopics: ['Hormonlar', 'İç Salgı Bezleri'] },
      { topic: 'Duyu Organları', subTopics: ['Göz', 'Kulak', 'Deri'] },
      { topic: 'Destek ve Hareket Sistemi', subTopics: ['İskelet', 'Kaslar'] },
      { topic: 'Sindirim Sistemi', subTopics: ['Sindirim Organları', 'Enzimler'] },
      { topic: 'Dolaşım Sistemi', subTopics: ['Kalp', 'Damarlar', 'Kan'] },
      { topic: 'Solunum Sistemi', subTopics: ['Solunum Organları', 'Gaz Değişimi'] },
      { topic: 'Boşaltım Sistemi', subTopics: ['Böbrekler', 'İdrar Oluşumu'] },
      { topic: 'Üreme Sistemi', subTopics: ['Üreme Organları', 'Embriyonik Gelişim'] },
    ],
    12: [
      { topic: 'Genden Proteine', subTopics: ['DNA ve RNA', 'Protein Sentezi', 'Genetik Mühendisliği'] },
      { topic: 'Canlılarda Enerji Dönüşümleri', subTopics: ['ATP', 'Metabolizma'] },
      { topic: 'Fotosentez', subTopics: ['Işık Reaksiyonları', 'Calvin Döngüsü'] },
      { topic: 'Hücresel Solunum', subTopics: ['Glikoliz', 'Krebs Döngüsü', 'Fermantasyon'] },
      { topic: 'Bitki Biyolojisi', subTopics: ['Bitkisel Dokular', 'Bitkilerde Taşıma', 'Bitkilerde Üreme'] },
      { topic: 'Komünite ve Popülasyon Ekolojisi', subTopics: ['Popülasyon Dinamiği', 'Komünite İlişkileri'] },
    ],
  },
  'Türk Dili ve Edebiyatı': {
    9: [
      { topic: 'Hikâye', subTopics: ['Olay Hikâyesi', 'Durum Hikâyesi', 'Hikâye Unsurları'] },
      { topic: 'Şiir', subTopics: ['Şiir Bilgisi', 'Ölçü ve Uyak', 'Söz Sanatları'] },
      { topic: 'Masal ve Fabl', subTopics: ['Masal Özellikleri', 'Fabl Özellikleri'] },
      { topic: 'Roman', subTopics: ['Roman Türleri', 'Roman Unsurları'] },
      { topic: 'Tiyatro', subTopics: ['Trajedi', 'Komedi', 'Dram'] },
      { topic: 'Dilekçe ve Tutanak', subTopics: ['Dilekçe Yazımı', 'Tutanak Yazımı'] },
    ],
    10: [
      { topic: 'Hikâye', subTopics: ['Türk Hikâyeciliği', 'Hikâye Tahlili'] },
      { topic: 'Şiir', subTopics: ['Divan Şiiri', 'Halk Şiiri'] },
      { topic: 'Destan ve Efsane', subTopics: ['Doğal Destanlar', 'Yapma Destanlar'] },
      { topic: 'Roman', subTopics: ['Tanzimat Romanı', 'Roman İnceleme'] },
      { topic: 'Tiyatro', subTopics: ['Geleneksel Tiyatro', 'Modern Tiyatro'] },
      { topic: 'Anı ve Biyografi', subTopics: ['Anı Yazısı', 'Biyografi-Otobiyografi'] },
    ],
    11: [
      { topic: 'Hikâye', subTopics: ['Cumhuriyet Dönemi Hikâyesi'] },
      { topic: 'Şiir', subTopics: ['Tanzimat Şiiri', 'Servet-i Fünun Şiiri', 'Milli Edebiyat Şiiri'] },
      { topic: 'Roman', subTopics: ['Servet-i Fünun Romanı', 'Milli Edebiyat Romanı'] },
      { topic: 'Tiyatro', subTopics: ['Tanzimat Tiyatrosu'] },
      { topic: 'Eleştiri', subTopics: ['Eleştiri Türü', 'Eleştiri Yöntemleri'] },
      { topic: 'Mülakat ve Röportaj', subTopics: ['Mülakat', 'Röportaj'] },
    ],
    12: [
      { topic: 'Cumhuriyet Dönemi Şiiri', subTopics: ['Garip Akımı', 'İkinci Yeni', 'Toplumcu Şiir'] },
      { topic: 'Roman', subTopics: ['Cumhuriyet Dönemi Romanı', 'Toplumcu Gerçekçi Roman'] },
      { topic: 'Hikâye', subTopics: ['Modern Hikâye'] },
      { topic: 'Tiyatro', subTopics: ['Cumhuriyet Dönemi Tiyatrosu'] },
      { topic: 'Deneme', subTopics: ['Deneme Türü', 'Deneme Yazarları'] },
      { topic: 'Söylev', subTopics: ['Söylev (Nutuk) Türü'] },
    ],
  },
  Tarih: {
    9: [
      { topic: 'Tarih ve Zaman', subTopics: ['Tarih Bilimi', 'Zaman ve Takvim'] },
      { topic: 'İnsanlığın İlk Dönemleri', subTopics: ['Tarih Öncesi Çağlar', 'İlk Uygarlıklar'] },
      { topic: 'Orta Çağ’da Dünya', subTopics: ['Feodalite', 'Orta Çağ Devletleri'] },
      { topic: 'İlk ve Orta Çağlarda Türk Dünyası', subTopics: ['İlk Türk Devletleri', 'Kavimler Göçü'] },
      { topic: 'İslam Medeniyetinin Doğuşu', subTopics: ['İslamiyetin Doğuşu', 'Dört Halife Dönemi'] },
      { topic: 'Türklerin İslamiyet’i Kabulü', subTopics: ['Karahanlılar', 'Gazneliler', 'Büyük Selçuklu'] },
    ],
    10: [
      { topic: 'Yerleşme ve Devletleşme', subTopics: ['Anadolu’nun Türkleşmesi', 'Anadolu Selçuklu'] },
      { topic: 'Beylikten Devlete Osmanlı', subTopics: ['Osmanlı’nın Kuruluşu', 'Kuruluş Dönemi Padişahları'] },
      { topic: 'Dünya Gücü Osmanlı', subTopics: ['İstanbul’un Fethi', 'Yükselme Dönemi'] },
      { topic: 'Sultan ve Osmanlı Merkez Teşkilatı', subTopics: ['Divan-ı Hümayun', 'Tımar Sistemi'] },
    ],
    11: [
      { topic: 'Değişen Dünya Dengeleri', subTopics: ['Coğrafi Keşifler', 'Rönesans ve Reform'] },
      { topic: 'Değişim Çağında Avrupa ve Osmanlı', subTopics: ['Duraklama Dönemi', 'Islahatlar'] },
      { topic: 'Uluslararası İlişkilerde Denge Stratejisi', subTopics: ['Osmanlı-Avrupa İlişkileri'] },
      { topic: 'Devrimler Çağında Osmanlı', subTopics: ['Fransız İhtilali', 'Milliyetçilik Akımı'] },
    ],
    12: [
      { topic: '20. Yüzyıl Başlarında Osmanlı', subTopics: ['Trablusgarp Savaşı', 'Balkan Savaşları', 'I. Dünya Savaşı'] },
      { topic: 'Milli Mücadele', subTopics: ['Kuvayımilliye', 'Cepheler', 'TBMM’nin Açılışı'] },
      { topic: 'Atatürkçülük ve Türk İnkılabı', subTopics: ['İnkılaplar', 'Atatürk İlkeleri'] },
      { topic: 'II. Dünya Savaşı', subTopics: ['Savaşın Nedenleri', 'Türkiye ve Savaş'] },
      { topic: 'Soğuk Savaş Dönemi', subTopics: ['Bloklaşma', 'Türkiye’nin Dış Politikası'] },
    ],
  },
  Coğrafya: {
    9: [
      { topic: 'Doğa ve İnsan', subTopics: ['Coğrafyanın Konusu', 'İnsan-Doğa Etkileşimi'] },
      { topic: 'Dünya’nın Şekli ve Hareketleri', subTopics: ['Günlük Hareket', 'Yıllık Hareket'] },
      { topic: 'Harita Bilgisi', subTopics: ['Ölçek', 'İzohipsler', 'Projeksiyonlar'] },
      { topic: 'İklim Bilgisi', subTopics: ['Sıcaklık', 'Basınç ve Rüzgârlar', 'Nem ve Yağış'] },
      { topic: 'Yer Şekilleri', subTopics: ['İç Kuvvetler', 'Dış Kuvvetler'] },
      { topic: 'Nüfus', subTopics: ['Nüfus Dağılışı', 'Nüfus Özellikleri'] },
    ],
    10: [
      { topic: 'Yer Şekilleri ve Oluşum Süreçleri', subTopics: ['Jeolojik Zamanlar', 'Türkiye’nin Yer Şekilleri'] },
      { topic: 'Nüfus Politikaları', subTopics: ['Nüfus Artışı', 'Nüfus Politikaları'] },
      { topic: 'Göç', subTopics: ['İç Göç', 'Dış Göç'] },
      { topic: 'Ekonomik Faaliyetler', subTopics: ['Tarım', 'Sanayi', 'Hizmet'] },
      { topic: 'Doğal Afetler', subTopics: ['Depremler', 'Sel ve Heyelan'] },
    ],
    11: [
      { topic: 'Biyoçeşitlilik', subTopics: ['Ekosistem Çeşitliliği', 'Biyom'] },
      { topic: 'Ekosistem', subTopics: ['Madde Döngüsü', 'Enerji Akışı'] },
      { topic: 'Nüfus ve Yerleşme', subTopics: ['Şehirleşme', 'Kır Yerleşmeleri'] },
      { topic: 'Ekonomik Faaliyetler ve Doğal Kaynaklar', subTopics: ['Enerji Kaynakları', 'Madenler'] },
      { topic: 'Bölgeler', subTopics: ['Bölge Kavramı', 'Bölge Türleri'] },
    ],
    12: [
      { topic: 'Şehirler ve Etki Alanları', subTopics: ['Küresel Şehirler', 'Şehir Fonksiyonları'] },
      { topic: 'Üretim, Dağıtım ve Tüketim', subTopics: ['Üretim Sektörleri', 'Ticaret ve Ulaşım'] },
      { topic: 'Çevre ve Toplum', subTopics: ['Doğal Çevre Sorunları', 'Çevre Koruma'] },
      { topic: 'Küresel Ortam: Ülkeler ve Bölgeler', subTopics: ['Jeopolitik Konum', 'Bölgesel Örgütler'] },
    ],
  },
  Felsefe: {
    10: [
      { topic: 'Felsefeyi Tanıma', subTopics: ['Felsefenin Anlamı', 'Felsefe ve Bilgi'] },
      { topic: 'Bilgi Felsefesi', subTopics: ['Bilginin Kaynağı', 'Doğruluk ve Gerçeklik'] },
      { topic: 'Varlık Felsefesi', subTopics: ['Varlığın Niceliği', 'Varlığın Niteliği'] },
      { topic: 'Ahlak Felsefesi', subTopics: ['Ahlaki Eylem', 'Özgürlük ve Sorumluluk'] },
      { topic: 'Sanat Felsefesi', subTopics: ['Sanat ve Estetik', 'Güzellik'] },
      { topic: 'Din Felsefesi', subTopics: ['Tanrı Anlayışları', 'Din-Felsefe İlişkisi'] },
      { topic: 'Siyaset Felsefesi', subTopics: ['Devlet', 'Egemenlik ve Meşruiyet'] },
      { topic: 'Bilim Felsefesi', subTopics: ['Bilimin Doğası', 'Bilimsel Yöntem'] },
    ],
    11: [
      { topic: 'MÖ 6 - MS 2. Yüzyıl Felsefesi', subTopics: ['İlk Çağ Felsefesi', 'Sokrates-Platon-Aristoteles'] },
      { topic: 'MS 2 - 15. Yüzyıl Felsefesi', subTopics: ['Patristik Felsefe', 'Skolastik Felsefe', 'İslam Felsefesi'] },
      { topic: '15 - 17. Yüzyıl Felsefesi', subTopics: ['Rönesans Felsefesi', 'Rasyonalizm-Empirizm'] },
      { topic: '18 - 19. Yüzyıl Felsefesi', subTopics: ['Aydınlanma Felsefesi', 'Alman İdealizmi'] },
      { topic: '20. Yüzyıl Felsefesi', subTopics: ['Varoluşçuluk', 'Analitik Felsefe'] },
    ],
  },
  İngilizce: {
    9: [
      { topic: 'Studying Abroad', subTopics: ['Vocabulary', 'Present Simple', 'Speaking'] },
      { topic: 'My Environment', subTopics: ['Prepositions', 'There is/are'] },
      { topic: 'Movies', subTopics: ['Film Genres', 'Past Simple'] },
      { topic: 'Human in Nature', subTopics: ['Nature Vocabulary', 'Comparatives'] },
      { topic: 'Inspirational People', subTopics: ['Biographies', 'Past Tense'] },
      { topic: 'Bridging Cultures', subTopics: ['Cultures', 'Modals'] },
      { topic: 'World Heritage', subTopics: ['Heritage Sites', 'Passive Voice'] },
      { topic: 'Emergency and Health Problems', subTopics: ['Health Vocabulary', 'Should/Must'] },
    ],
    10: [
      { topic: 'School Life', subTopics: ['Daily Routines', 'Adverbs of Frequency'] },
      { topic: 'Plans', subTopics: ['Future Plans', 'Going to / Will'] },
      { topic: 'Legendary Figures', subTopics: ['Past Continuous', 'Storytelling'] },
      { topic: 'Traditions', subTopics: ['Used to', 'Cultural Vocabulary'] },
      { topic: 'Travel', subTopics: ['Travel Vocabulary', 'Present Perfect'] },
      { topic: 'Helpful Tips', subTopics: ['Imperatives', 'Advice'] },
      { topic: 'Food and Festivals', subTopics: ['Countable-Uncountable', 'Quantifiers'] },
      { topic: 'Digital Era', subTopics: ['Technology Vocabulary', 'Passive Voice'] },
    ],
    11: [
      { topic: 'Future Jobs', subTopics: ['Job Vocabulary', 'Future Tenses'] },
      { topic: 'Hobbies and Skills', subTopics: ['Gerunds-Infinitives', 'Ability'] },
      { topic: 'Hard Times', subTopics: ['Past Perfect', 'Narrative Tenses'] },
      { topic: 'What a Life', subTopics: ['Reported Speech', 'Life Events'] },
      { topic: 'Back to the Past', subTopics: ['Used to / Would', 'History'] },
      { topic: 'Open Your Heart', subTopics: ['Conditionals', 'Feelings'] },
      { topic: 'Facts about Türkiye', subTopics: ['Passive Voice', 'Geography'] },
      { topic: 'Sports', subTopics: ['Sports Vocabulary', 'Comparatives'] },
    ],
    12: [
      { topic: 'Music', subTopics: ['Music Genres', 'Relative Clauses'] },
      { topic: 'Friendship', subTopics: ['Phrasal Verbs', 'Conditionals'] },
      { topic: 'Human Rights', subTopics: ['Modals of Obligation', 'Rights Vocabulary'] },
      { topic: 'Coming Soon', subTopics: ['Future Continuous', 'Predictions'] },
      { topic: 'Psychology', subTopics: ['Wish Clauses', 'Emotions'] },
      { topic: 'Favors', subTopics: ['Requests', 'Polite Language'] },
      { topic: 'News Stories', subTopics: ['Reported Speech', 'Passive'] },
      { topic: 'Alternative Energy', subTopics: ['Energy Vocabulary', 'Causatives'] },
    ],
  },
};

/**
 * Seçili ders ve sınıf(lar) için müfredat ağacını (konu → alt konular)
 * döndürür. Birden fazla sınıf seçiliyse aynı konu adları birleştirilir
 * (alt konular tekrarsız merge edilir).
 */
export function getCurriculumTree(subject: string, grades: number[]): CurriculumUnit[] {
  const bySubject = MEB_CURRICULUM[subject];
  if (!bySubject) return [];
  const gradeList = grades.length > 0 ? grades : [9, 10, 11, 12];
  const byTopic = new Map<string, Set<string>>();
  const order: string[] = [];
  for (const g of gradeList) {
    for (const unit of bySubject[g] ?? []) {
      if (!byTopic.has(unit.topic)) {
        byTopic.set(unit.topic, new Set());
        order.push(unit.topic);
      }
      const set = byTopic.get(unit.topic)!;
      for (const st of unit.subTopics) set.add(st);
    }
  }
  return order.map((topic) => ({ topic, subTopics: Array.from(byTopic.get(topic)!) }));
}

/**
 * Seçili ders ve sınıf(lar) için üst konu adlarının düz listesini döndürür
 * (tekrarsız, sırayı korur). Geriye dönük uyumluluk için korunur.
 */
export function getCurriculumTopics(subject: string, grades: number[]): string[] {
  return getCurriculumTree(subject, grades).map((u) => u.topic);
}
