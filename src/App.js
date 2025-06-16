import React, { useState, useEffect } from 'react';
import { Search, User, UserCheck, Calendar, BookOpen, Users, Briefcase, ChevronLeft, ChevronRight, Plus, Trash2, Edit, Save, X, Loader } from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setLogLevel } from 'firebase/firestore';


// --- Firebase Configuration ---
// In a real deployment, these values would come from environment variables.
// For local development, you can replace the placeholder with your actual config.
const firebaseConfig = process.env.REACT_APP_FIREBASE_CONFIG ? JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG) : {};
const appId = process.env.REACT_APP_APP_ID || 'default-app-id';

// --- Helper Components ---
const Modal = ({ children, isOpen, onClose, title }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                 <header className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1 rounded-full transition-colors"><X size={24} /></button>
                </header>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};
const Input = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input {...props} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
);
const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }) => {
    const baseClasses = "px-4 py-2 rounded-lg font-semibold flex items-center justify-center transition-colors";
    const variants = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-200',
        danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400',
    };
    return <button onClick={onClick} disabled={disabled} className={`${baseClasses} ${variants[variant]} ${className}`}>{children}</button>;
};
const LoadingSpinner = () => (
    <div className="flex justify-center items-center p-10">
        <Loader className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="mr-4 text-gray-600">جاري تحميل البيانات...</p>
    </div>
);
const InfoSection = ({ title, icon, children }) => (
  <div className="border-b pb-4 mb-4 last:border-b-0">
    <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">{icon && React.cloneElement(icon, { className: "ml-3 w-6 h-6" })}{title}</h3>
    <div className="space-y-2 pr-4">{children}</div>
  </div>
);
const InfoRow = ({ label, value }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
    <p className="font-semibold text-gray-600">{label}:</p>
    <p className="sm:col-span-2 text-gray-800">{value || '-'}</p>
  </div>
);
const NavItem = ({ icon, label, view, activeView, setActiveView }) => (
  <li className="mr-2">
    <button onClick={() => setActiveView(view)}
      className={`inline-flex items-center justify-center p-4 border-b-2 rounded-t-lg transition-colors duration-200 ${ activeView === view ? 'border-blue-500 text-blue-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' }`}>
      {icon} {label}
    </button>
  </li>
);

// --- Generic CRUD View ---
const CrudView = ({ db, collectionName, singularName, pluralName, searchField, DetailsComponent, FormComponent, Icon }) => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const collectionPath = `artifacts/${appId}/public/data/${collectionName}`;

    useEffect(() => {
        if (!db) { setIsLoading(false); return; }
        const itemCollectionRef = collection(db, collectionPath);
        const unsubscribe = onSnapshot(itemCollectionRef, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(data);
            setIsLoading(false);
        }, (error) => {
            console.error(`Error fetching ${collectionName}:`, error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [db, collectionPath, collectionName]);

    const filteredItems = items.filter(i => i[searchField] && i[searchField].toLowerCase().includes(searchTerm.toLowerCase()));

    useEffect(() => {
        if (filteredItems.length === 1 && searchTerm) {
            const foundItem = items.find(i => i.id === filteredItems[0].id);
            setSelectedItem(foundItem);
        } else {
            setSelectedItem(null);
        }
    }, [searchTerm, items, filteredItems]);
    
    const handleAdd = () => { setEditingItem(null); setIsModalOpen(true); };
    const handleEdit = (item) => { setEditingItem(item); setIsModalOpen(true); };
    
    const handleDelete = async (itemId) => {
        if (window.confirm(`هل أنت متأكد من حذف هذا الـ ${singularName}؟`)) {
            try {
                await deleteDoc(doc(db, collectionPath, itemId));
                setSelectedItem(null);
                setSearchTerm('');
            } catch (error) { console.error(`Error deleting ${singularName}:`, error); }
        }
    };
    
    const handleSave = async (itemData) => {
        try {
            if (editingItem) {
                const { id, ...dataToUpdate } = itemData;
                await updateDoc(doc(db, collectionPath, editingItem.id), dataToUpdate);
            } else {
                await addDoc(collection(db, collectionPath), itemData);
            }
            setIsModalOpen(false);
            setEditingItem(null);
        } catch (error) { console.error(`Error saving ${singularName}:`, error); }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? `تعديل ${singularName}` : `إضافة ${singularName} جديد`}>
                <FormComponent item={editingItem} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
            </Modal>
            
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold flex items-center"><Icon className="ml-2" /> {pluralName}</h2>
                 <Button onClick={handleAdd} disabled={!db}><Plus size={18} className="ml-2" /> إضافة {singularName}</Button>
            </div>
           
            <div className="relative mb-6">
                <input type="text" placeholder={`ابحث عن ${singularName}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-3 pr-10 border border-gray-300 rounded-lg" disabled={!db}/>
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
            
            {isLoading ? <LoadingSpinner /> : (
                selectedItem ? (
                    <DetailsComponent item={selectedItem} onEdit={handleEdit} onDelete={handleDelete} />
                ) : (
                    <div className="text-center text-gray-500 py-10">
                       <p>{!db ? "جاري الاتصال بقاعدة البيانات..." : `ابحث عن ${singularName} أو قم بإضافة ${singularName} جديد.`}</p>
                    </div>
                )
            )}
        </div>
    );
};

// --- Trainee Components ---
const TraineeDetails = ({ item, onEdit, onDelete }) => (
    <div className="animate-fade-in space-y-6">
        <div className="flex justify-end gap-2"><Button onClick={() => onEdit(item)} variant="secondary"><Edit size={16} className="ml-2" /> تعديل</Button><Button onClick={() => onDelete(item.id)} variant="danger"><Trash2 size={16} className="ml-2" /> حذف</Button></div>
        <InfoSection title="البيانات الشخصية" icon={<User className="text-blue-500" />}><InfoRow label="الاسم الثلاثي" value={item.name} /><InfoRow label="الرقم الوطني" value={item.nationalId} /><InfoRow label="السكن" value={item.address} /></InfoSection>
        <InfoSection title="الكورسات المسجلة" icon={<BookOpen className="text-green-500" />}><p className="text-gray-500">سيتم إضافة تفاصيل الكورسات هنا.</p></InfoSection>
    </div>
);
const TraineeForm = ({ item, onSave, onCancel }) => {
    const [formData, setFormData] = useState(item || { name: '', nationalId: '', address: '' });
    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSubmit = e => { e.preventDefault(); onSave(formData); };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="الاسم الثلاثي" name="name" value={formData.name} onChange={handleChange} required />
            <Input label="الرقم الوطني" name="nationalId" value={formData.nationalId} onChange={handleChange} />
            <Input label="السكن" name="address" value={formData.address} onChange={handleChange} />
            <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="secondary" onClick={onCancel}>إلغاء</Button><Button type="submit"><Save size={18} className="ml-2" /> حفظ</Button></div>
        </form>
    );
};

// --- Trainer Components ---
const TrainerDetails = ({ item, onEdit, onDelete }) => (
    <div className="animate-fade-in space-y-6">
        <div className="flex justify-end gap-2"><Button onClick={() => onEdit(item)} variant="secondary"><Edit size={16} className="ml-2" /> تعديل</Button><Button onClick={() => onDelete(item.id)} variant="danger"><Trash2 size={16} className="ml-2" /> حذف</Button></div>
        <InfoSection title="البيانات الشخصية" icon={<User className="text-blue-500" />}><InfoRow label="الاسم الثلاثي" value={item.name} /><InfoRow label="رقم الهاتف" value={item.phone} /><InfoRow label="الاختصاص" value={item.specialty} /></InfoSection>
        <InfoSection title="بيانات التعاقد" icon={<Briefcase className="text-indigo-500" />}><InfoRow label="تاريخ التعاقد" value={item.contractStart} /><InfoRow label="تاريخ الانتهاء" value={item.contractEnd} /></InfoSection>
    </div>
);
const TrainerForm = ({ item, onSave, onCancel }) => {
    const [formData, setFormData] = useState(item || { name: '', phone: '', specialty: '', contractStart: '', contractEnd: '' });
    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSubmit = e => { e.preventDefault(); onSave(formData); };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="الاسم الثلاثي" name="name" value={formData.name} onChange={handleChange} required />
            <Input label="رقم الهاتف" name="phone" value={formData.phone} onChange={handleChange} />
            <Input label="الاختصاص" name="specialty" value={formData.specialty} onChange={handleChange} />
            <Input label="تاريخ التعاقد" name="contractStart" type="date" value={formData.contractStart} onChange={handleChange} />
            <Input label="تاريخ الانتهاء" name="contractEnd" type="date" value={formData.contractEnd} onChange={handleChange} />
            <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="secondary" onClick={onCancel}>إلغاء</Button><Button type="submit"><Save size={18} className="ml-2" /> حفظ</Button></div>
        </form>
    );
};

// --- Schedule Components ---
const ScheduleView = ({ db }) => {
    const [events, setEvents] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const collectionPath = `artifacts/${appId}/public/data/schedule`;

    useEffect(() => {
        if (!db) { setIsLoading(false); return; }
        const scheduleCollectionRef = collection(db, collectionPath);
        const unsubscribe = onSnapshot(scheduleCollectionRef, (snapshot) => {
            const eventsByDate = snapshot.docs.reduce((acc, doc) => {
                const event = { id: doc.id, ...doc.data() };
                const date = event.date;
                if (!acc[date]) { acc[date] = []; }
                acc[date].push(event);
                return acc;
            }, {});
            setEvents(eventsByDate);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [db, collectionPath]);

    const changeMonth = (offset) => {
        setCurrentDate(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + offset); return d; });
        setSelectedDay(null);
    };

    const handleSave = async (eventData) => {
        try {
            await addDoc(collection(db, collectionPath), eventData);
            setIsModalOpen(false);
        } catch (error) { console.error("Error saving event:", error); }
    };
    
    const handleDelete = async (eventId) => {
        if(window.confirm('هل أنت متأكد من حذف هذه الفعالية؟')) {
             await deleteDoc(doc(db, collectionPath, eventId));
        }
    }

    const startDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`إضافة فعالية ليوم ${selectedDay}`}>
                <ScheduleForm onSave={handleSave} onCancel={() => setIsModalOpen(false)} eventDate={selectedDay} />
            </Modal>
            
            <h2 className="text-xl font-bold mb-4 flex items-center"><Calendar className="ml-2" /> جدولة الكورسات</h2>
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-200"><ChevronRight /></button>
                <h3 className="text-lg font-semibold">{currentDate.toLocaleString('ar-EG', { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-200"><ChevronLeft /></button>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center font-semibold mb-2">
                {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => <div key={day}>{day}</div>)}
            </div>
            
            {isLoading ? <LoadingSpinner /> : (
                 <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: startDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="border rounded-lg h-24"></div>)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayEvents = events[dateStr] || [];
                        return (
                            <div key={day} onClick={() => setSelectedDay(dateStr)}
                                 className={`border rounded-lg h-28 p-2 flex flex-col cursor-pointer transition-colors ${selectedDay === dateStr ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}>
                                <div className="font-bold">{day}</div>
                                <div className="text-xs mt-1 space-y-1 overflow-y-auto">
                                    {dayEvents.map(event => (<div key={event.id} className="bg-blue-500 text-white rounded px-1 truncate">{event.courseName}</div>))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedDay && (
                <div className="mt-6 p-4 border rounded-lg bg-gray-50 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-xl mb-4">فعاليات يوم: {selectedDay}</h3>
                        <Button onClick={() => setIsModalOpen(true)}><Plus size={16} className="ml-2" /> إضافة فعالية</Button>
                    </div>
                    {events[selectedDay] && events[selectedDay].length > 0 ? (
                        events[selectedDay].map(event => (
                            <div key={event.id} className="p-3 bg-white rounded-lg shadow-sm mb-2 flex justify-between items-center">
                                <div>
                                    <p className="font-bold">{event.courseName}</p>
                                    <p className="text-sm text-gray-600">{`القاعة: ${event.hall} | الوقت: ${event.time}`}</p>
                                </div>
                                <Button onClick={() => handleDelete(event.id)} variant="danger" className="p-2"><Trash2 size={16} /></Button>
                            </div>
                        ))
                    ) : <p className="text-gray-500 text-center p-4">لا توجد فعاليات مجدولة.</p>}
                </div>
            )}
        </div>
    );
};
const ScheduleForm = ({ onSave, onCancel, eventDate }) => {
    const [formData, setFormData] = useState({ date: eventDate, courseName: '', hall: '', time: '' });
    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSubmit = e => { e.preventDefault(); onSave(formData); };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="اسم الكورس/الفعالية" name="courseName" value={formData.courseName} onChange={handleChange} required />
            <Input label="القاعة" name="hall" value={formData.hall} onChange={handleChange} />
            <Input label="الوقت (مثال: 16:00 - 18:00)" name="time" value={formData.time} onChange={handleChange} />
            <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="secondary" onClick={onCancel}>إلغاء</Button><Button type="submit"><Save size={18} className="ml-2" /> حفظ</Button></div>
        </form>
    );
};


// --- Main App ---
function App() {
  const [activeView, setActiveView] = useState('trainees');
  const [db, setDb] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing. Please set REACT_APP_FIREBASE_CONFIG environment variable.");
        setAuthReady(true); // Allow UI to render with a warning
        return;
    };
    try {
        setLogLevel('debug');
        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const dbInstance = getFirestore(app);
        setDb(dbInstance);

        onAuthStateChanged(authInstance, async (user) => {
            if (!user) {
                try {
                    // In a real app, you wouldn't expose a generic token like this.
                    // This is a placeholder for the platform's auth mechanism.
                    const token = process.env.REACT_APP_FIREBASE_TOKEN || null;
                    if (token) {
                         await signInWithCustomToken(authInstance, token);
                    } else {
                         await signInAnonymously(authInstance);
                    }
                } catch (error) { console.error("Auth failed:", error); }
            }
            setAuthReady(true);
        });
    } catch (error) { console.error("Firebase init error:", error); }
  }, []);

  const renderView = () => {
    if (!authReady) return <LoadingSpinner />;
    if (!db) return <div className="text-center p-8 bg-white rounded-lg shadow-md"><p className="text-red-600 font-bold">فشل الاتصال بقاعدة البيانات. يرجى التحقق من إعدادات Firebase.</p></div>;
    
    switch (activeView) {
      case 'trainees': return <CrudView db={db} collectionName="trainees" singularName="متدرب" pluralName="تفاصيل المتدربين" searchField="name" DetailsComponent={TraineeDetails} FormComponent={TraineeForm} Icon={Users} />;
      case 'trainers': return <CrudView db={db} collectionName="trainers" singularName="مدرب" pluralName="تفاصيل المدربين" searchField="name" DetailsComponent={TrainerDetails} FormComponent={TrainerForm} Icon={UserCheck} />;
      case 'schedule': return <ScheduleView db={db} />;
      default: return null;
    }
  };

  return (
    <div dir="rtl" className="bg-gray-100 min-h-screen font-sans text-gray-800">
      <div className="container mx-auto p-4 sm:p-6">
        <header className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-700">إدارة مركز صلة التدريبي (الإشراف)</h1>
          <nav className="mt-4">
            <ul className="flex flex-wrap border-b border-gray-200">
              <NavItem icon={<Users />} label="المتدربين" view="trainees" activeView={activeView} setActiveView={setActiveView} />
              <NavItem icon={<UserCheck />} label="المدربين" view="trainers" activeView={activeView} setActiveView={setActiveView} />
              <NavItem icon={<Calendar />} label="جدولة الكورسات" view="schedule" activeView={activeView} setActiveView={setActiveView} />
            </ul>
          </nav>
        </header>
        <main> {renderView()} </main>
      </div>
    </div>
  );
}

// --- CSS for animations (Can be moved to a CSS file) ---
const style = document.createElement('style');
style.textContent = `@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }`;
document.head.append(style);

export default App;
