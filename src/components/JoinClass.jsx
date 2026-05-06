import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';

export default function JoinClass() {
  const [classCode, setClassCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!classCode) return;
    
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Oturum açık değil.");

      // Öğretmeni bul (classCode'u eşleşen teacher)
      const q = query(
        collection(db, "users"), 
        where("classCode", "==", classCode.toUpperCase()), 
        where("role", "==", "teacher")
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Geçersiz veya bulunmayan Sınıf Kodu.");
      }

      const teacherDoc = querySnapshot.docs[0];
      const teacherId = teacherDoc.id;

      // 1. Öğrencinin 'teacherId' alanını güncelle
      await updateDoc(doc(db, "users", currentUser.uid), {
        teacherId: teacherId
      });

      // 2. Öğretmenin 'students' dizisine bu öğrencinin UID'sini ekle
      await updateDoc(doc(db, "users", teacherId), {
        students: arrayUnion(currentUser.uid)
      });

      setMessage({ type: 'success', text: 'Sınıfa başarıyla katıldınız!' });
      setClassCode('');
    } catch (error) {
      console.error("Katılma hatası:", error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel p-6">
      <h2 className="section-title mb-4 flex items-center gap-2">
        <UserPlus size={20} className="text-indigo-400" /> Sınıfa Bağlan
      </h2>
      <p className="text-sm text-slate-400 mb-4">Öğretmeninin verdiği 6 haneli sınıf kodunu girerek sınıf ortamına katıl.</p>
      
      <form onSubmit={handleJoin} className="flex gap-3">
        <input 
          type="text" 
          value={classCode}
          onChange={(e) => setClassCode(e.target.value.toUpperCase())}
          placeholder="Sınıf Kodu (Örn: A1B2C3)"
          className="flex-1 p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          maxLength={6}
          required
        />
        <button 
          type="submit" 
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Katıl'}
        </button>
      </form>
      
      {message.text && (
        <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}
    </div>
  );
}
