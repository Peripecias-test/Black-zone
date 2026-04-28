/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Scissors, 
  MapPin, 
  Phone, 
  Instagram, 
  Facebook, 
  Calendar, 
  Clock, 
  ExternalLink,
  Smartphone,
  ChevronRight,
  Menu,
  X,
  Star,
  Check,
  LogIn,
  LogOut,
  User as UserIcon
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
  getDocFromServer,
  orderBy,
  limit
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Firebase initialization with environment variable fallback for security
const firebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId,
};

const app = initializeApp(firebaseOptions);
const db = getFirestore(app, import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

const SERVICES = [
  {
    category: "Cortes & Barba",
    items: [
      { name: "Corte Tradicional", price: "R$ 50", desc: "Acabamento clássico com máquina e tesoura" },
      { name: "Corte na Tesoura", price: "R$ 55", desc: "Ajuste manual detalhado para maior naturalidade" },
      { name: "Corte Infantil", price: "R$ 60", desc: "Atendimento especializado para os pequenos" },
      { name: "Barba Tradicional", price: "R$ 50", desc: "Toalha quente e navalte para maior conforto" },
      { name: "Combo Legado", price: "R$ 90", desc: "Cabelo + Barba com lavagem especial" },
    ]
  },
  {
    category: "Química & Especialidades",
    items: [
      { name: "Platinado", price: "R$ 150", desc: "Clareamento total e matização premium" },
      { name: "Alinhamento Capilar", price: "R$ 80", desc: "Redução de volume e frizz" },
      { name: "Sobrancelha", price: "R$ 25", desc: "Design com navalha ou pinça" },
      { name: "Barboterapia", price: "R$ 55", desc: "Tratamento completo para os fios da barba" },
    ]
  }
];

const TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  // Mapping and State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Booking State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isMyBookingsModalOpen, setIsMyBookingsModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [step, setStep] = useState(1); // 1: Service Selection, 2: Date Selection, 3: Time Selection, 4: Confirmation
  const [selectedService, setSelectedService] = useState<{name: string, price: string} | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [userIP, setUserIP] = useState<string>('');
  const [waAction, setWaAction] = useState<{ title: string, message: string, url: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bookingToCancel, setBookingToCancel] = useState<any | null>(null);
  const [errorModal, setErrorModal] = useState<{ title: string, message: string } | null>(null);
  
  const [isBooking, setIsBooking] = useState(false);
  const [waSent, setWaSent] = useState(false);
  const [showWaInstruction, setShowWaInstruction] = useState(false);
  const [cancelWaSent, setCancelWaSent] = useState(false);
  const [showCancelInstruction, setShowCancelInstruction] = useState(false);
  const [dontShowInstructions, setDontShowInstructions] = useState(() => {
    try {
      return localStorage.getItem('legado_skip_instructions') === 'true';
    } catch {
      return false;
    }
  });
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoginExplainerOpen, setIsLoginExplainerOpen] = useState(false);
  const [showPersuasiveBookingModal, setShowPersuasiveBookingModal] = useState(false);
  
  // New State for persistence
  const [bookings, setBookings] = useState<{date: string, time: string}[]>([]);
  const [userBookingIds, setUserBookingIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('legado_booking_ids') || '[]');
    } catch {
      return [];
    }
  });
  const [myBookingsDetails, setMyBookingsDetails] = useState<any[]>([]);

  // Helpers for Calendar
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  
  const canCancel = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const appointmentDate = new Date(year, month - 1, day);
    appointmentDate.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    // Can cancel until the day before the appointment
    return tomorrow <= appointmentDate;
  };
  
  const getNext90Days = () => {
    const days = [];
    let count = 0;
    while (days.length < 90) {
      const d = new Date();
      d.setDate(d.getDate() + count);
      // Skip Sundays (0)
      if (d.getDay() !== 0) {
        days.push(d);
      }
      count++;
    }
    return days;
  };

  const next90Days = getNext90Days();

  const getAvailableTimes = (date: Date) => {
    const day = date.getDay(); // 1-6
    const isSaturday = day === 6;
    
    // Saturday: 09:00 - 18:00 (limit 18:00)
    // Weekdays: 09:00 - 20:00 (limit 20:00)
    return TIMES.filter(time => {
      const hour = parseInt(time.split(':')[0]);
      
      // If Saturday, max slot is 17:00 (finishing at 18:00)
      if (isSaturday && hour >= 18) return false;
      
      // Weekdays max slot is 19:00 (finishing at 20:00)
      if (!isSaturday && hour >= 20) return false;

      // Filter out past times for today
      const now = new Date();
      if (formatDate(date) === formatDate(now)) {
        const [h, m] = time.split(':').map(Number);
        const slotDate = new Date(now);
        slotDate.setHours(h, m, 0, 0);
        return slotDate > now;
      }

      return true;
    });
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Detect when user returns from WhatsApp
  useEffect(() => {
    const handleVisibilityChange = () => {
      // User returned from WhatsApp
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [waSent, isBooking]);

  useEffect(() => {
    // Fetch IP
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setUserIP(data.ip))
      .catch(() => setUserIP('Identificação do Sistema'));
  }, []);

  useEffect(() => {
    // Real-time listener for ALL bookings (to show filled slots)
    const unsubscribe = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAt = new Date();
        try {
          if (data.createdAt) {
            createdAt = data.createdAt.toDate();
          }
        } catch (e) {
          // Local timestamp issue
        }
        
        return {
          id: doc.id,
          date: data.date,
          time: data.time,
          status: data.status || 'confirmado',
          createdAt: createdAt
        };
      });
      setBookings(bookingsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bookings');
    });

    return () => unsubscribe();
  }, []);

  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('google_access_token');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribeAuth();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar.events');
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (token) {
        setGoogleAccessToken(token);
        try {
          localStorage.setItem('google_access_token', token);
        } catch (e) {
          console.warn('localStorage não disponível:', e);
        }
      }
      setIsLoginExplainerOpen(false);
      setShowPersuasiveBookingModal(false);
    } catch (error) {
      console.error("Erro no login:", error);
    }
  };

  const logout = () => {
    signOut(auth);
    setGoogleAccessToken(null);
    try {
      localStorage.removeItem('google_access_token');
    } catch (e) {
      console.warn('localStorage não disponível:', e);
    }
  };

  const createGoogleCalendarEvent = async (booking: any) => {
    let token = googleAccessToken;
    if (!token) {
      try {
        token = localStorage.getItem('google_access_token');
      } catch (e) {
        console.warn('localStorage não disponível:', e);
      }
    }
    if (!token) return;

    try {
      // Normalize time to HH:mm with leading zeros if necessary
      let timePart = booking.time;
      if (!timePart.includes(':')) {
        if (timePart.length === 3) timePart = '0' + timePart;
      } else {
        const [h, m] = timePart.split(':');
        timePart = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
      }
      const normalizedTime = timePart.includes(':') ? timePart : `${timePart.slice(0,2)}:${timePart.slice(2)}`;
      
      const startDateTimeString = `${booking.date}T${normalizedTime}:00`;
      const startDateTime = new Date(startDateTimeString);
      
      if (isNaN(startDateTime.getTime())) {
        throw new Error(`Data/Hora inválida: ${startDateTimeString}`);
      }

      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      
      // Calculate days difference for reminders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = new Date(startDateTime);
      eventDate.setHours(0, 0, 0, 0);
      const diffTime = eventDate.getTime() - today.getTime();
      const daysDifference = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      const event = {
        summary: `💈 ${booking.serviceName} - ${booking.userName || 'Cliente'} (Legado da Barba)`,
        description: `Agendamento realizado via Legado da Barba.\n\nServiço: ${booking.serviceName}\nCliente: ${booking.userName || 'Não informado'}\nData: ${booking.date}\nHorário: ${normalizedTime}`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        reminders: {
          useDefault: false,
          overrides: daysDifference >= 1 
            ? [
                { method: 'popup', minutes: 1440 }, // 1 dia antes
                { method: 'popup', minutes: 60 },   // 1 hora antes
              ]
            : [
                { method: 'popup', minutes: 60 },   // 1 hora antes
              ],
        },
      };

      console.log('Enviando para Google Calendar:', event);

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (response.status === 401) {
        try {
          localStorage.removeItem('google_access_token');
        } catch (e) {
          console.warn('localStorage não disponível:', e);
        }
        setGoogleAccessToken(null);
        alert('Sua sessão do Google Agenda expirou. Faça login novamente para sincronizar seu próximo agendamento.');
        return;
      }

      if (!response.ok) {
        const err = await response.json();
        console.error('Google Calendar Error:', err);
        throw new Error(err.error?.message || 'Erro do Google Agenda');
      }
      
      console.log('Evento criado no Google Agenda!');
      alert('Horário adicionado ao seu Google Agenda com sucesso! 📅');
    } catch (error: any) {
      console.error('Erro no Google Agenda:', error);
      alert('Não foi possível sincronizar com seu Google Agenda: ' + error.message);
    }
  };

  useEffect(() => {
    const fetchMyDetails = async () => {
      let idsToFetch = [...userBookingIds];
      let details: any[] = [];

      // Always filter from the real-time bookings first
      const locallyMatched = bookings.filter(b => userBookingIds.includes(b.id));
      details = [...locallyMatched];

      // If logged in, fetch by userId too
      if (user) {
        try {
          const q = query(
            collection(db, 'bookings'), 
            where('userId', '==', user.uid),
            limit(40)
          );
          const snapshot = await getDocs(q);
          const userBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Merge and remove duplicates
          const seen = new Set(details.map(d => d.id));
          userBookings.forEach(ub => {
            if (!seen.has(ub.id)) {
              details.push(ub);
            }
          });
        } catch (error) {
          console.error("Erro ao buscar agendamentos do usuário:", error);
        }
      }

      setMyBookingsDetails(details);
    };

    fetchMyDetails();
  }, [user, userBookingIds, bookings]);

  const navLinks = [
    { name: 'Início', href: '#home' },
    { name: 'Serviços', href: '#services' },
    { name: 'Meus Agendamentos', onClick: () => setIsMyBookingsModalOpen(true) },
    { name: 'Quem Somos', href: '#about' },
    { name: 'Localização', onClick: () => setIsMapModalOpen(true) },
  ];

  const isTimeOccupied = (dateStr: string, time: string) => {
    return bookings.some(b => b.date === dateStr && b.time === time && b.status === 'confirmado');
  };

  const isDayFull = (date: Date) => {
    const available = getAvailableTimes(date);
    if (available.length === 0) return true; // Sunday or already passed
    return available.every(time => isTimeOccupied(formatDate(date), time));
  };

  const resetBooking = () => {
    setIsBookingModalOpen(false);
    setStep(1);
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setWaSent(false);
    setCancelWaSent(false);
    setShowWaInstruction(false);
    setShowCancelInstruction(false);
    setIsBooking(false);
    setCurrentBookingId(null);
    setBookingToCancel(null);
  };

  const handleBookingStart = (service: {name: string, price: string}) => {
    setSelectedService(service);
    setStep(2);
    setIsBookingModalOpen(true);
    // Determine if we should show instructions
    const skip = localStorage.getItem('legado_skip_instructions') === 'true';
    setShowWaInstruction(!skip);
  };

  const initiateWhatsApp = async () => {
    if (!selectedService || !selectedDate || !selectedTime || isBooking) {
      alert("Por favor, selecione todos os campos.");
      return;
    }

    setIsBooking(true);
    const dateStr = formatDate(selectedDate);
    const bookingId = `${dateStr}_${selectedTime.replace(':', '')}`;
    
    try {
      // Check if slot is truly free
      const docRef = doc(db, 'bookings', bookingId);
      let docSnap;
      try {
        docSnap = await getDocFromServer(docRef);
      } catch (error) {
        // If we can't check, we might want to proceed or stop
        // Usually, 404 is fine.
      }
      
      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'confirmado') {
           alert("Este horário já foi preenchido. Por favor, escolha outro.");
           resetBooking();
           return;
        }
      }

      setCurrentBookingId(bookingId);

      // WhatsApp Message
      const readableDate = selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
      const message = [
        "*SOLICITAÇÃO DE AGENDAMENTO*",
        "",
        `DATA: ${readableDate}`,
        `HORA: ${String(selectedTime)}`,
        `SERVIÇO: ${String(selectedService.name)}`,
        `VALOR: ${String(selectedService.price)}`,
        "",
        "Estou enviando esta mensagem para confirmar meu interesse no horário. Por favor, reserve para mim!"
      ].join("\n");

      const whatsappUrl = `https://wa.me/5511995202058?text=${encodeURIComponent(message)}`;
      
      // Open WhatsApp
      window.open(whatsappUrl, '_blank') || (window.location.href = whatsappUrl);
      
      // Switch to confirmation step in UI
      setWaSent(true);
    } catch (error) {
      console.error("Erro ao preparar reserva:", error);
      alert("Erro ao conectar com o servidor. Tente novamente.");
    } finally {
      setIsBooking(false);
    }
  };

  const finalizeBooking = async (bypassLoginPrompt: any = false) => {
    if (!currentBookingId || isBooking || !selectedService || !selectedDate || !selectedTime) return;
    
    // Explicitly check for boolean true to bypass. Event objects are truthy but not boolean true.
    const shouldBypass = bypassLoginPrompt === true;

    // Se não estiver logado e não for um bypass, mostra o modal de persuasão
    if (!user && !shouldBypass) {
      setShowPersuasiveBookingModal(true);
      return;
    }

    setIsBooking(true);
    setShowPersuasiveBookingModal(false); // Fecha o modal se estiver aberto
    
    try {
      const docRef = doc(db, 'bookings', currentBookingId);
      const dateStr = formatDate(selectedDate);
      
      // Final data for confirmed booking
      const bookingData = {
        serviceName: selectedService.name,
        price: selectedService.price,
        date: dateStr,
        time: selectedTime,
        userIP: userIP || 'Gravado via App',
        status: 'confirmado',
        userId: user?.uid || null,
        userEmail: user?.email || null,
        userName: user?.displayName || null,
        createdAt: serverTimestamp(),
        confirmedAt: serverTimestamp()
      };

      await setDoc(docRef, bookingData);

      // Create Google Calendar event if user is logged in with Google
      if (user) {
        createGoogleCalendarEvent(bookingData);
      }

      // Save to local storage for "My Bookings"
      const newIds = Array.from(new Set([...userBookingIds, currentBookingId]));
      setUserBookingIds(newIds);
      localStorage.setItem('legado_booking_ids', JSON.stringify(newIds));

      // Success
      resetBooking();
      setWaAction({
        title: "Agendamento Confirmado!",
        message: "Seu horário foi marcado com sucesso no sistema e sua vaga está garantida. Nos vemos em breve!",
        url: "" 
      });

    } catch (error: any) {
      if (error.message?.includes('permission-denied') || error.code === 'permission-denied') {
        alert("Ops! Alguém acabou de reservar este horário ou houve um erro de validação (ex: regra de segurança). Por favor, tente escolher outro horário.");
      } else {
        handleFirestoreError(error, OperationType.WRITE, `bookings/${currentBookingId}`);
      }
      resetBooking();
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelInitiate = (booking: any) => {
    if (!canCancel(booking.date)) {
      setErrorModal({
        title: "Prazo Excedido",
        message: "Operação bloqueada: Cancelamentos só podem ser realizados com no mínimo 24h de antecedência."
      });
      return;
    }
    setBookingToCancel(booking);
    const skip = localStorage.getItem('legado_skip_instructions') === 'true';
    
    if (skip) {
      // If skip is true, set the state correctly to show the "Did you send it?" step
      // But first, we should probably trigger the WhatsApp message.
      // However, we can't open a window without a user interaction.
      // So we'll show the modal but go straight to the "sent" step? 
      // User said "se a pessoa marca apenas nesse campo, não quero que ela precise voltar e confirmar".
      // This is tricky because we NEED a click to open WhatsApp.
      // Let's show the modal but it will be at the state where the button is visible.
      setShowCancelInstruction(true); // We still need the modal to show the buttons
      setCancelWaSent(false); 
      // If we want to really skip, we would need to know they clicked something.
    } else {
      setShowCancelInstruction(true);
      setCancelWaSent(false);
    }
  };

  const confirmCancelWhatsApp = () => {
    if (!bookingToCancel) return;

    const readableDate = new Date(bookingToCancel.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const message = [
      "*CANCELAMENTO DE AGENDAMENTO*",
      "",
      `DATA: ${readableDate}`,
      `HORA: ${bookingToCancel.time}`,
      `SERVIÇO: ${bookingToCancel.serviceName}`,
      "",
      "Gostaria de informar que precisei cancelar este horário. Desculpe o transtorno!"
    ].join("\n");

    const whatsappUrl = `https://wa.me/5511995202058?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp
    window.open(whatsappUrl, '_blank') || (window.location.href = whatsappUrl);
    
    // Switch to confirmation step
    setCancelWaSent(true);
  };

  const finalizeCancel = async () => {
    if (!bookingToCancel) return;
    
    setDeletingId(bookingToCancel.id);
    try {
      await deleteDoc(doc(db, 'bookings', bookingToCancel.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bookings/${bookingToCancel.id}`);
    }
    
    try {
      const newIds = userBookingIds.filter(bid => bid !== bookingToCancel.id);
      setUserBookingIds(newIds);
      localStorage.setItem('legado_booking_ids', JSON.stringify(newIds));
      
      // Update details state
      setMyBookingsDetails(prev => prev.filter(b => b.id !== bookingToCancel.id));
      
      resetBooking();
      setWaAction({
        title: "Cancelado com Sucesso",
        message: "Seu agendamento foi removido do sistema. Nos vemos em outra oportunidade!",
        url: ""
      });
    } catch (error) {
      console.error("Erro ao atualizar local storage:", error);
      resetBooking();
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSkipInstructions = (checked: boolean) => {
    setDontShowInstructions(checked);
    localStorage.setItem('legado_skip_instructions', String(checked));
    
    // Se o usuário marcou para não mostrar, fechamos as instruções atuais
    if (checked) {
      setShowWaInstruction(false);
      setShowCancelInstruction(false);
    }
  };

  const wipeAllBookings = async () => {
    if (!confirm("⚠️ ATENÇÃO: Isso apagará TODOS os agendamentos do sistema (inclusive de outros usuários). Deseja continuar?")) return;
    
    try {
      const querySnapshot = await getDocs(collection(db, 'bookings'));
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      alert("Agenda limpa com sucesso!");
    } catch (error) {
      console.error("Erro ao limpar agenda:", error);
      alert("Erro ao limpar agenda. Verifique as permissões.");
    }
  };

  return (
    <div className="min-h-screen text-text-base selection:bg-primary/10">
      {/* Top Info Bar */}
      <div className="bg-primary text-white py-2 px-6 flex justify-between items-center text-[10px] uppercase tracking-[0.3em] font-bold">
        <div className="hidden md:flex gap-8">
          <span>Seg — Sex: 09h às 20h</span>
          <span>Sáb: 09h às 18h</span>
        </div>
        <div className="flex gap-6 mx-auto md:mx-0">
          <a href="tel:5511995202058" className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
            <Phone size={12} /> (11) 99520-2058
          </a>
          <button 
            onClick={() => setIsMapModalOpen(true)}
            className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer"
          >
            <MapPin size={12} /> SP - Consolação
          </button>
        </div>
      </div>

      {/* Navbar */}
      <nav className={`sticky top-0 w-full z-40 transition-all duration-300 border-b ${scrolled ? 'bg-white/90 backdrop-blur-md py-4 shadow-sm border-border-base' : 'bg-bg-base py-8 border-transparent'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex flex-col items-start leading-none group cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
            <span className="font-serif text-2xl font-bold tracking-tighter text-primary">BLACK ZONE</span>
            <span className="text-[9px] uppercase tracking-[0.4em] text-accent font-bold mt-1">Barbearia Tradicional</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href} 
                onClick={(e) => {
                  if (link.onClick) {
                    e.preventDefault();
                    link.onClick();
                  }
                }}
                className="font-sans text-xs uppercase tracking-widest font-semibold text-accent hover:text-primary transition-colors cursor-pointer"
              >
                {link.name}
              </a>
            ))}

            {user ? (
              <div className="flex items-center gap-4 pl-4 border-l border-border-base">
                <div className="text-right">
                  <p className="text-[10px] font-bold text-text-base leading-none mb-1">{user.displayName}</p>
                  <button onClick={logout} className="text-[8px] uppercase tracking-widest text-accent hover:text-red-500 transition-colors">Sair</button>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-border-base" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <UserIcon size={14} />
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={() => setIsLoginExplainerOpen(true)}
                className="flex items-center gap-2 font-sans text-xs uppercase tracking-widest font-bold text-primary hover:text-primary/80 transition-colors"
              >
                <LogIn size={14} /> Entrar
              </button>
            )}

            <button 
              onClick={() => { setStep(1); setIsBookingModalOpen(true); }}
              className="bg-primary text-white px-6 py-3 font-sans text-xs uppercase tracking-widest hover:bg-primary/90 transition-all rounded-sm"
            >
              Agendar Agora
            </button>
          </div>

          {/* Mobile Toggle */}
          <button className="md:hidden text-text-base p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-text-base/20 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white w-[80%] max-w-[300px] h-full relative shadow-2xl flex flex-col p-8 pt-24"
            >
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="absolute top-8 right-8 text-primary hover:rotate-90 transition-transform duration-300"
              >
                <X size={28} />
              </button>
              
              <div className="space-y-2 mb-12">
                <div className="w-8 h-0.5 bg-primary" />
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-accent">Menu</p>
              </div>

              <div className="flex flex-col space-y-6">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => {
                      if (link.onClick) {
                        e.preventDefault();
                        link.onClick();
                      }
                      setIsMenuOpen(false);
                    }}
                    className="text-2xl font-serif italic text-text-base hover:text-primary transition-all hover:pl-2"
                  >
                    {link.name}
                  </a>
                ))}

                {!user && (
                  <button
                    onClick={() => { setIsLoginExplainerOpen(true); setIsMenuOpen(false); }}
                    className="flex items-center gap-3 text-xl font-serif italic text-primary hover:pl-2 transition-all"
                  >
                    <LogIn size={20} /> Login com Google
                  </button>
                )}
              </div>

              <div className="mt-auto space-y-6">
                {user && (
                  <div className="flex items-center gap-4 p-4 bg-bg-base rounded-2xl border border-border-base">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} className="w-12 h-12 rounded-full border border-border-base" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <UserIcon size={24} />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-xs font-bold text-text-base">{user.displayName}</p>
                      <button onClick={logout} className="text-[10px] uppercase tracking-widest text-accent mt-1">Sair da conta</button>
                    </div>
                  </div>
                )}
                <button 
                  onClick={() => { setIsMenuOpen(false); setIsBookingModalOpen(true); }}
                  className="w-full bg-primary text-white py-5 rounded-xl font-sans text-[10px] uppercase tracking-widest font-bold shadow-xl shadow-primary/20"
                >
                  Agende sua visita
                </button>
                
                <div className="text-center pt-8 border-t border-border-base/50">
                  <p className="text-[9px] uppercase tracking-widest text-accent font-medium leading-relaxed">
                    Legado da tradição em cada detalhe.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Modal */}
      <AnimatePresence>
        {errorModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 text-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-text-base/90 backdrop-blur-md"
              onClick={() => setErrorModal(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-10 relative z-10 border border-border-base shadow-2xl flex flex-col items-center"
            >
              <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6">
                <X size={40} />
              </div>
              
              <h3 className="text-3xl font-serif italic mb-4">{errorModal.title}</h3>
              <p className="text-sm text-gray-500 font-light leading-relaxed mb-8">
                {errorModal.message}
              </p>
              
              <button 
                onClick={() => setErrorModal(null)}
                className="w-full bg-text-base text-white py-5 rounded-2xl font-sans text-[10px] uppercase tracking-[0.2em] font-bold shadow-xl hover:bg-black transition-all"
              >
                Compreendi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WhatsApp Action Success Modal */}
      <AnimatePresence>
        {waAction && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 text-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-text-base/80 backdrop-blur-xl"
              onClick={() => setWaAction(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-10 relative z-10 border border-border-base shadow-2xl flex flex-col items-center"
            >
              <div className="w-20 h-20 bg-primary/5 text-primary rounded-full flex items-center justify-center mb-6">
                <Check size={40} />
              </div>
              
              <h3 className="text-3xl font-serif italic mb-4">{waAction.title}</h3>
              <p className="text-sm text-gray-500 font-light leading-relaxed mb-8">
                {waAction.message}
              </p>
              
              <div className="space-y-4 w-full">
                <a 
                  href={waAction.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setWaAction(null)}
                  className="block w-full bg-primary text-white py-5 rounded-2xl font-sans text-[10px] uppercase tracking-[0.2em] font-bold shadow-xl shadow-primary/20 hover:bg-primary/95 transition-all"
                >
                  Abrir WhatsApp
                </a>
                <button 
                  onClick={() => setWaAction(null)}
                  className="text-[9px] uppercase tracking-widest font-bold text-accent hover:text-primary transition-colors"
                >
                  Fechar janela
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section id="home" className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-bg-base border-b border-border-base pt-10 md:pt-0">
        <div className="container mx-auto px-6 grid md:grid-cols-2 gap-12 items-center h-full py-12 md:py-0">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="space-y-8 text-center md:text-left z-10"
          >
            <div className="space-y-4">
              <span className="text-accent font-bold tracking-[0.4em] uppercase text-[10px]">Excelência em Imagem</span>
              <h2 className="text-5xl sm:text-6xl md:text-8xl font-serif font-medium leading-[1.05] tracking-tight text-text-base">
                O seu estilo <br />é a sua <span className="italic text-accent underline decoration-border-base decoration-offset-8">história</span>.
              </h2>
              <p className="font-sans text-base md:text-lg text-gray-500 max-w-md mx-auto md:mx-0 leading-relaxed font-light">
                Resgatando a tradição da barbearia clássica com um toque de modernidade. Um espaço dedicado ao homem de bom gosto.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 pt-4 items-center md:items-start justify-center md:justify-start">
              <button 
                onClick={() => { setStep(1); setIsBookingModalOpen(true); }}
                className="w-full sm:w-auto bg-primary text-white px-10 py-5 font-sans text-sm uppercase tracking-widest hover:bg-primary/95 transition-all rounded-sm flex items-center justify-center gap-3 shadow-2xl shadow-primary/20"
              >
                <Calendar size={18} /> Agendar Agora
              </button>
              <div className="flex items-center gap-4 px-2">
                <div className="w-12 h-12 rounded-full border border-border-base flex items-center justify-center italic text-lg font-serif">BZ</div>
                <p className="font-sans text-[10px] uppercase tracking-widest text-accent font-bold leading-tight text-left">
                  Tradição em <br />cada movimento
                </p>
              </div>
            </div>
          </motion.div>

          <div className="relative h-[400px] md:h-full block">
            <div className="absolute inset-y-0 md:inset-y-12 right-0 md:right-0 w-full md:w-full bg-white rounded-[40px] md:rounded-l-[200px] shadow-sm border border-border-base overflow-hidden">
               <img 
                src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=2070&auto=format&fit=crop" 
                alt="Barber Shop Interior" 
                className="w-full h-full object-cover grayscale opacity-90 contrast-125"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-32 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-24 space-y-4">
            <span className="text-accent font-bold tracking-[0.5em] uppercase text-[10px]">Menu de Cuidados</span>
            <h2 className="text-5xl font-serif italic tracking-tight">Nossos Serviços</h2>
            <div className="w-12 h-px bg-primary mx-auto mt-6" />
          </div>

          <div className="grid lg:grid-cols-2 gap-x-24 gap-y-20">
            {SERVICES.map((category, idx) => (
              <div key={idx} className="space-y-12">
                <h3 className="text-xs uppercase tracking-[0.4em] font-bold text-accent border-b border-border-base pb-4">{category.category}</h3>
                <div className="space-y-10">
                  {category.items.map((item, i) => (
                    <motion.div 
                      key={i} 
                      whileHover={{ x: 5 }}
                      className="group cursor-pointer flex justify-between items-start"
                      onClick={() => handleBookingStart(item)}
                    >
                      <div className="space-y-1 flex-1 pr-6 border-b border-dashed border-border-base pb-4">
                        <h4 className="font-sans text-sm font-bold uppercase tracking-wider group-hover:text-primary transition-colors">{item.name}</h4>
                        <p className="font-sans text-xs text-gray-400 font-light italic">{item.desc}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 ml-4">
                        <span className="font-serif text-xl font-medium text-primary">{item.price}</span>
                        <span className="text-[10px] uppercase tracking-widest text-accent font-bold opacity-0 group-hover:opacity-100 transition-opacity">Reservar</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 md:py-32 bg-bg-base border-y border-border-base">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 md:gap-20 items-center">
            <div className="space-y-8 md:space-y-10 text-center md:text-left">
              <span className="text-accent font-bold tracking-[0.3em] uppercase text-[10px]">Nossa História</span>
              <h2 className="text-4xl md:text-6xl font-serif font-medium leading-tight text-text-base">Quem Somos</h2>
              <div className="space-y-6 text-gray-500 font-light leading-relaxed text-base md:text-lg">
                <p>
                  A Barbearia Black Zone nasceu com o desejo de proporcionar uma <strong className="text-primary font-medium italic underline decoration-border-base decoration-4 decoration-offset-4">experiência única de atendimento</strong> a um preço justo.
                </p>
                <p>
                  Fundada em 2020, rapidamente conquistamos quem busca um corte impecável em um ambiente sofisticado e acolhedor. Para nós, cada corte de cabelo é uma oportunidade de transformar o dia de alguém.
                </p>
                <p className="font-serif text-3xl italic text-primary pt-4">Sonhe Grande!</p>
              </div>
            </div>
            
            <div className="relative p-6 md:p-10 bg-white border border-border-base rounded-[40px] shadow-sm">
               <div className="absolute top-0 right-0 w-32 h-32 bg-bg-base rounded-bl-full -mr-6 -mt-6 md:-mr-10 md:-mt-10 opacity-50"></div>
               <img 
                src="https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=800&auto=format&fit=crop" 
                className="grayscale rounded-3xl border border-border-base relative z-10 w-full" 
                alt="Barber"
               />
               <div className="absolute -bottom-4 -left-4 md:-bottom-6 md:-left-6 bg-primary text-white p-4 md:p-6 rounded-2xl z-20 shadow-xl max-w-[160px] md:max-w-[200px]">
                 <Star className="mb-2 fill-white text-white" />
                 <p className="font-bold text-xs md:text-sm uppercase tracking-widest leading-tight">Excelência Certificada</p>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Location Section */}
      <section id="contact" className="py-32 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20">
            <div className="space-y-12">
              <div className="space-y-4">
                <h2 className="text-5xl font-serif font-medium">Onde Estamos</h2>
                <div className="w-16 h-1 bg-primary" />
              </div>

              <div className="space-y-10">
                <div className="flex gap-6">
                  <div className="w-14 h-14 rounded-full border border-border-base flex items-center justify-center text-primary shrink-0 bg-bg-base">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs uppercase tracking-[.25em] font-bold mb-2">Endereço</h4>
                    <p className="text-gray-500 font-light">Rua da Consolação, 327 - Consolação<br />São Paulo - SP, 01301-000</p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="w-14 h-14 rounded-full border border-border-base flex items-center justify-center text-primary shrink-0 bg-bg-base">
                    <Phone size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs uppercase tracking-[.25em] font-bold mb-2">Contato</h4>
                    <p className="text-gray-500 font-light">(11) 99520-2058</p>
                    <p className="text-gray-500 font-light">contato@blackzone.com.br</p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="w-14 h-14 rounded-full border border-border-base flex items-center justify-center text-primary shrink-0 bg-bg-base">
                    <Clock size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs uppercase tracking-[.25em] font-bold mb-2">Horários</h4>
                    <div className="grid grid-cols-2 gap-x-12 text-gray-500 font-light">
                      <span>Seg — Sex:</span> <span>09h às 20h</span>
                      <span>Sábado:</span> <span>09h às 18h</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-bg-base p-12 md:p-16 rounded-[40px] border border-border-base flex flex-col justify-center">
               <h3 className="text-4xl font-serif mb-8 italic">Agende uma visita</h3>
               <p className="text-gray-500 font-light leading-relaxed mb-10 text-lg">
                 Escolha seu serviço favorito e agende em poucos segundos via WhatsApp. Estamos prontos para te atender.
               </p>
               <button 
                onClick={() => { setStep(1); setIsBookingModalOpen(true); }}
                className="w-full bg-primary text-white py-6 font-sans text-xs uppercase tracking-[0.3em] font-bold hover:bg-primary/95 transition-all flex items-center justify-center gap-3 shadow-xl"
               >
                 Abrir Agendador <ChevronRight size={16} />
               </button>
               
               <div className="mt-12 flex gap-6 border-t border-border-base pt-10">
                <a href="#" className="text-accent hover:text-primary transition-colors"><Instagram size={28} /></a>
                <a href="#" className="text-accent hover:text-primary transition-colors"><Facebook size={28} /></a>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-[#E8E4D9] text-text-base">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex flex-col items-center md:items-start leading-none group cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
            <span className="font-serif text-xl font-bold tracking-tighter text-primary">BLACK ZONE</span>
            <span className="text-[8px] uppercase tracking-[0.4em] text-accent font-bold mt-1">Barbearia Tradicional</span>
          </div>
          
          <div className="flex gap-12 text-[10px] uppercase tracking-[0.3em] font-bold text-accent">
            <span className="opacity-60">© 2026 Black Zone</span>
            <span className="hidden md:inline transition-opacity hover:opacity-60 cursor-pointer">Política de Privacidade</span>
          </div>

          <div className="flex gap-6 grayscale opacity-40">
            <div className="w-8 h-5 border border-text-base rounded-sm" /> {/* Visa Mock icon */}
            <div className="w-8 h-5 border border-text-base rounded-sm" /> {/* Master Mock icon */}
            <div className="w-8 h-5 border border-text-base rounded-sm flex items-center justify-center text-[6px] font-bold">PIX</div>
          </div>
        </div>
      </footer>

      {/* Location Map Modal */}
      <AnimatePresence>
        {isMapModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          >
            <div className="absolute inset-0 bg-text-base/90 backdrop-blur-md" onClick={() => setIsMapModalOpen(false)} />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-5xl bg-bg-base overflow-hidden rounded-3xl shadow-2xl flex flex-col md:flex-row min-h-[500px]"
            >
              {/* Map Info */}
              <div className="w-full md:w-1/3 p-10 bg-white flex flex-col justify-between border-r border-border-base">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <button 
                      onClick={() => setIsMapModalOpen(false)}
                      className="text-[10px] uppercase font-bold text-accent flex items-center gap-2 hover:text-primary transition-colors mb-6"
                    >
                      <ChevronRight size={12} className="rotate-180" /> fechar janelar
                    </button>
                    <h3 className="text-4xl font-serif italic leading-tight">Nossa Unidade Consolação</h3>
                    <div className="w-12 h-1 bg-primary" />
                  </div>

                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center text-primary flex-shrink-0 border border-primary/10">
                        <MapPin size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-accent tracking-widest mb-1">Endereço</p>
                        <p className="text-sm font-medium text-text-base leading-relaxed">R. da Consolação, 1234 - Consolação, São Paulo - SP, 01302-001</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-primary/5 rounded-full flex items-center justify-center text-primary flex-shrink-0 border border-primary/10">
                        <Clock size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-accent tracking-widest mb-1">Funcionamento</p>
                        <p className="text-sm font-medium text-text-base">Seg a Sex: 09h - 20h</p>
                        <p className="text-sm font-medium text-text-base">Sábados: 09h - 18h</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-10">
                  <a 
                    href="https://www.google.com/maps/dir/?api=1&destination=R.+da+Consolação,+São+Paulo+-+SP" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full py-5 bg-text-base text-white text-[10px] uppercase tracking-[0.2em] font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-primary transition-all shadow-xl group text-center"
                  >
                    Como Chegar <ExternalLink size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform inline" />
                  </a>
                </div>
              </div>

              {/* Map Embed */}
              <div className="flex-1 bg-gray-100 relative h-[400px] md:h-auto">
                <iframe 
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3657.487770003001!2d-46.6534563!3d-23.5513988!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce58334466b733%3A0xe54e60ac03405785!2zUi4gZGEgQ29uc29sYcOnw6NvIC0gU8OjbyBQYXVsbywgU1A!5e0!3m2!1spt-BR!2sbr!4v1714058400000!5m2!1spt-BR!2sbr" 
                  className="absolute inset-0 w-full h-full grayscale-[0.5] contrast-[1.1] brightness-[0.9]"
                  style={{ border: 0 }} 
                  allowFullScreen 
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLoginExplainerOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsLoginExplainerOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden relative shadow-2xl p-8 z-[160]"
            >
              <button 
                onClick={() => setIsLoginExplainerOpen(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-primary transition-colors"
              >
                <X size={24} />
              </button>

              <div className="space-y-6 text-center">
                <div className="w-20 h-20 bg-primary/5 text-primary rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/10">
                  <Calendar size={32} strokeWidth={1.5} />
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-2xl font-serif italic text-text-base leading-tight">Sincronizar Agenda</h3>
                  <p className="text-sm text-gray-500 font-light leading-relaxed">
                    Deseja conectar sua conta Google para que seus agendamentos sejam <strong className="text-primary font-bold italic">adicionados automaticamente</strong> ao seu Google Agenda?
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <button 
                    onClick={loginWithGoogle}
                    className="w-full bg-primary text-white py-4 rounded-2xl font-sans text-xs uppercase tracking-[0.2em] font-bold hover:bg-primary/95 transition-all shadow-xl shadow-primary/10 flex items-center justify-center gap-3"
                  >
                    Sim, Quero Sincronizar <LogIn size={14} />
                  </button>
                  <button 
                    onClick={() => setIsLoginExplainerOpen(false)}
                    className="w-full py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400 hover:text-accent transition-colors"
                  >
                    Agora não, obrigado
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPersuasiveBookingModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowPersuasiveBookingModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden relative shadow-2xl p-8 z-[210] text-center"
            >
              <div className="w-20 h-20 bg-primary/5 text-primary rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/10">
                <Star size={32} strokeWidth={1.5} className="animate-pulse" />
              </div>
              
              <div className="space-y-4 mb-8">
                <h3 className="text-2xl font-serif italic text-text-base leading-tight">Experiência VIP</h3>
                <p className="text-sm text-gray-500 font-light leading-relaxed">
                  Ao entrar com o <strong className="text-primary italic">Google</strong>, seu agendamento será sincronizado automaticamente e você receberá lembretes inteligentes.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={loginWithGoogle}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-sans text-xs uppercase tracking-[0.2em] font-bold hover:bg-primary/95 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3"
                >
                  Entrar com Google <LogIn size={14} />
                </button>
                <button 
                  onClick={() => finalizeBooking(true)}
                  className="w-full py-4 text-[10px] uppercase tracking-widest font-bold text-accent hover:text-primary transition-colors"
                >
                  Continuar sem login
                </button>
                <button 
                  onClick={() => setShowPersuasiveBookingModal(false)}
                  className="mt-2 text-[8px] uppercase tracking-[0.2em] font-bold text-gray-400 hover:text-red-500 transition-colors"
                >
                  Cancelar e voltar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBookingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetBooking}
              className="absolute inset-0 bg-text-base/60 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-bg-base w-full max-w-lg rounded-[40px] p-8 md:p-12 relative z-10 border border-border-base shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-bl-full -mr-10 -mt-10 opacity-50" />
              
              <button 
                onClick={resetBooking}
                className="absolute top-8 right-8 text-gray-400 hover:text-primary transition-colors z-20"
              >
                <X size={28} />
              </button>

              {step === 1 && (
                <div className="space-y-10">
                  <div className="space-y-3">
                    <h3 className="text-4xl font-serif italic text-text-base">Escolha seu serviço</h3>
                    <div className="w-12 h-1 bg-primary" />
                    <p className="text-[10px] uppercase tracking-widest text-accent font-bold">Passo 1 de 3</p>
                  </div>
                  <div className="grid gap-4 max-h-[45vh] overflow-y-auto pr-3 custom-scrollbar">
                    {SERVICES.flatMap(c => c.items).map((item, i) => (
                      <button 
                        key={i}
                        onClick={() => { setSelectedService(item); setStep(2); }}
                        className="flex justify-between items-center p-5 bg-white border border-border-base hover:border-primary/50 transition-all text-left rounded-2xl group"
                      >
                         <div className="space-y-1">
                          <p className="font-bold uppercase tracking-widest text-[11px] group-hover:text-primary transition-colors">{item.name}</p>
                          <p className="text-[10px] text-gray-400 font-light italic">{item.desc}</p>
                         </div>
                         <span className="font-serif text-lg font-medium text-primary">{item.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8">
                  <div className="space-y-3">
                    <button onClick={() => setStep(1)} className="text-[10px] uppercase font-bold text-accent mb-4 flex items-center gap-2 hover:text-primary">
                      <ChevronRight size={12} className="rotate-180" /> serviços
                    </button>
                    <h3 className="text-4xl font-serif italic">Qual o melhor dia?</h3>
                    <div className="w-12 h-1 bg-primary" />
                    <p className="text-[10px] uppercase tracking-widest text-accent font-bold">Passo 2 de 3 (Próximos 90 dias)</p>
                  </div>
                  <div className="max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar space-y-8">
                    {/* Group by Month */}
                    {Object.entries(
                      next90Days.reduce((acc, date) => {
                        const month = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                        if (!acc[month]) acc[month] = [];
                        acc[month].push(date);
                        return acc;
                      }, {} as Record<string, Date[]>)
                    ).map(([month, days]) => {
                      const monthDays = days as Date[];
                      return (
                      <div key={month} className="space-y-4">
                        <h4 className="text-[10px] uppercase tracking-widest font-bold text-primary border-b border-border-base pb-2">{month}</h4>
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                          {monthDays.map((date) => {
                            const full = isDayFull(date);
                            return (
                            <button
                              key={date.getTime()}
                              disabled={full}
                              onClick={() => { if(!full) { setSelectedDate(date); setStep(3); } }}
                              className={`flex flex-col items-center justify-center py-4 border rounded-2xl transition-all ${
                                full
                                  ? 'bg-red-50/30 border-red-100 text-red-500/60 cursor-not-allowed'
                                  : selectedDate && formatDate(selectedDate) === formatDate(date)
                                    ? 'bg-primary text-white border-primary shadow-lg'
                                    : 'bg-white border-border-base hover:border-primary hover:text-primary'
                              }`}
                            >
                              <span className="text-[9px] uppercase font-bold opacity-60">
                                {date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                              </span>
                              <span className="text-xl font-serif font-medium">{date.getDate()}</span>
                              {full && <span className="text-[7px] uppercase font-bold mt-1 text-red-500">Lotado</span>}
                            </button>
                          ); })}
                        </div>
                      </div>
                    ); })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-10">
                  <div className="space-y-3">
                    <button onClick={() => { setStep(2); setSelectedTime(null); }} className="text-[10px] uppercase font-bold text-accent mb-4 flex items-center gap-2 hover:text-primary">
                      <ChevronRight size={12} className="rotate-180" /> calendário
                    </button>
                    <h3 className="text-4xl font-serif italic text-text-base">Qual o horário?</h3>
                    <div className="w-12 h-1 bg-primary" />
                    <p className="text-[10px] uppercase tracking-widest text-accent font-bold">Passo 3 de 3</p>
                    {selectedDate && (
                      <p className="text-[10px] uppercase font-bold text-primary mt-2">
                        Reservando para: {selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar text-center">
                    {selectedDate && getAvailableTimes(selectedDate).map(time => {
                      const occupied = isTimeOccupied(formatDate(selectedDate), time);
                      return (
                        <button 
                          key={time}
                          disabled={occupied}
                          onClick={() => { if(!occupied) { setSelectedTime(time); setStep(4); } }}
                          className={`py-6 border font-bold uppercase tracking-widest text-[11px] transition-all rounded-2xl ${
                            occupied 
                              ? 'bg-red-50/30 border-red-100 text-red-500/60 cursor-not-allowed' 
                              : selectedTime === time 
                                ? 'bg-primary text-white border-primary shadow-lg' 
                                : 'bg-white border-border-base hover:border-primary hover:text-primary'
                          }`}
                        >
                          {time}
                          {occupied && <span className="block text-[8px] mt-1 tracking-tighter text-red-500">Ocupado</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-10 text-center py-6">
                  {!waSent ? (
                    <>
                      {!showWaInstruction ? (
                        <>
                          <div className="w-24 h-24 bg-primary/5 text-primary rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/10">
                            <Calendar size={48} strokeWidth={1.5} />
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-4xl font-serif italic">Resumo do agendamento</h3>
                            <div className="max-w-xs mx-auto py-6 bg-white border-y border-dashed border-border-base space-y-3">
                               <p className="text-xs uppercase tracking-widest text-accent font-bold leading-none">{selectedService?.name}</p>
                               <p className="font-serif text-3xl text-primary leading-none">{selectedService?.price}</p>
                               <div className="flex flex-col items-center gap-2 pt-2">
                                 <p className="text-[10px] uppercase tracking-widest border border-primary/20 inline-block px-4 py-1.5 rounded-full">
                                   {selectedDate?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                 </p>
                                 <p className="text-[10px] uppercase tracking-widest bg-primary text-white inline-block px-4 py-1.5 rounded-full">{selectedTime}</p>
                               </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-4">
                            <button 
                              onClick={() => {
                                if (dontShowInstructions) {
                                  initiateWhatsApp();
                                } else {
                                  setShowWaInstruction(true);
                                }
                              }}
                              className="w-full bg-primary text-white py-6 rounded-2xl font-sans text-xs uppercase tracking-[0.3em] font-bold hover:bg-primary/95 transition-all shadow-xl shadow-primary/20"
                            >
                              {dontShowInstructions ? 'Confirmar e Abrir WhatsApp' : 'Continuar para reserva'}
                            </button>
                            <button 
                              onClick={() => setStep(3)}
                              className="text-[10px] uppercase tracking-widest font-bold text-gray-400 hover:text-accent"
                            >
                              Voltar e alterar horário
                            </button>
                          </div>
                        </>
                      ) : (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="space-y-8"
                        >
                          <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100 flex-col relative">
                            <Smartphone size={40} strokeWidth={1.5} />
                            <div className="absolute -right-2 top-0 bg-white p-2 rounded-full border border-amber-100 animate-bounce">
                              <ExternalLink size={16} />
                            </div>
                          </div>
                          <div className="space-y-4">
                            <h3 className="text-3xl font-serif italic text-text-base leading-tight">Agendamento rápido</h3>
                            <div className="space-y-6 text-sm text-gray-500 font-light leading-relaxed max-w-[280px] mx-auto text-left">
                              <div className="flex gap-4">
                                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                                <p>Clique no botão abaixo para abrir o WhatsApp.</p>
                              </div>
                              <div className="flex gap-4">
                                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                                <p>Envie a mensagem e <strong>retorne aqui</strong> para confirmar.</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-center gap-3 py-2">
                              <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative">
                                  <input 
                                    type="checkbox" 
                                    className="peer sr-only"
                                    checked={dontShowInstructions}
                                    onChange={(e) => toggleSkipInstructions(e.target.checked)}
                                  />
                                  <div className="w-5 h-5 border-2 border-border-base rounded-md transition-all peer-checked:bg-primary peer-checked:border-primary group-hover:border-primary/50" />
                                  <Check className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white scale-0 transition-transform peer-checked:scale-100" size={12} strokeWidth={3} />
                                </div>
                                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold group-hover:text-primary transition-colors">Não mostrar instruções novamente</span>
                              </label>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-4 pt-4">
                            <button 
                              onClick={initiateWhatsApp}
                              disabled={isBooking}
                              className="w-full bg-primary text-white py-6 rounded-2xl font-sans text-xs uppercase tracking-[0.3em] font-bold hover:bg-primary/95 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3"
                            >
                              {isBooking ? 'Processando...' : <>Ir para o WhatsApp <ExternalLink size={14} /></>}
                            </button>
                            <button 
                              onClick={() => setShowWaInstruction(false)}
                              className="text-[10px] uppercase tracking-widest font-bold text-gray-400 hover:text-accent"
                            >
                              Voltar para o resumo
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100 flex-col">
                        <Phone size={32} strokeWidth={1.5} className="mb-1" />
                        <Check size={16} className="-mt-2 ml-4 bg-white rounded-full p-0.5 border border-amber-100" />
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-3xl font-serif italic text-text-base leading-tight">Você enviou a mensagem?</h3>
                        <p className="text-sm text-gray-500 font-light leading-relaxed max-w-[280px] mx-auto">
                          Se você já enviou a mensagem para o barbeiro, clique no botão abaixo para <strong className="text-primary font-medium">garantir sua vaga</strong> no sistema.
                        </p>
                        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 mt-6">
                           <p className="text-[10px] uppercase tracking-widest font-bold text-primary mb-1">Horário Escolhido</p>
                           <p className="text-sm font-serif italic">{selectedDate?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {selectedTime}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-4 pt-4">
                        <button 
                          onClick={() => finalizeBooking()}
                          disabled={isBooking}
                          className={`w-full py-6 rounded-2xl font-sans text-xs uppercase tracking-[0.3em] font-bold transition-all shadow-xl ${
                            isBooking 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                              : 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20'
                          }`}
                        >
                          {isBooking ? 'Finalizando...' : 'Confirmar e Finalizar Agendamento'}
                        </button>
                        <button 
                          onClick={() => setWaSent(false)}
                          className="text-[10px] uppercase tracking-widest font-bold text-gray-400 hover:text-accent"
                        >
                          Reenviar mensagem no WhatsApp
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCancelInstruction && bookingToCancel && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={resetBooking}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden relative shadow-2xl p-8 text-center z-10"
            >
              <button 
                onClick={resetBooking}
                className="absolute top-6 right-6 text-gray-400 hover:text-primary transition-colors"
              >
                <X size={24} />
              </button>

                  {!cancelWaSent ? (
                    <div className="space-y-8">
                      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 flex-col relative">
                        <Smartphone size={32} strokeWidth={1.5} />
                        <div className="absolute -right-2 top-0 bg-white p-2 rounded-full border border-red-100">
                          <ExternalLink size={12} />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-3xl font-serif italic text-text-base leading-tight">Confirmar cancelamento?</h3>
                        <div className="space-y-5 text-sm text-gray-500 font-light leading-relaxed text-left">
                          <p className="text-center italic">Você será redirecionado ao WhatsApp para avisar o barbeiro.</p>
                        </div>

                    <div className="flex items-center justify-center gap-3 pt-4">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            className="peer sr-only"
                            checked={dontShowInstructions}
                            onChange={(e) => toggleSkipInstructions(e.target.checked)}
                          />
                          <div className="w-5 h-5 border-2 border-border-base rounded-md transition-all peer-checked:bg-primary peer-checked:border-primary group-hover:border-primary/50" />
                          <Check className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white scale-0 transition-transform peer-checked:scale-100" size={12} strokeWidth={3} />
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold group-hover:text-primary transition-colors">Não mostrar instruções novamente</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={confirmCancelWhatsApp}
                      className="w-full bg-red-500 text-white py-5 rounded-2xl font-sans text-xs uppercase tracking-[0.3em] font-bold hover:bg-red-600 transition-all shadow-xl shadow-red-500/20 flex items-center justify-center gap-3"
                    >
                      Ir para o WhatsApp <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100 flex-col">
                    <Check size={32} strokeWidth={1.5} />
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-3xl font-serif italic text-text-base leading-tight">Mensagem enviada?</h3>
                    <p className="text-sm text-gray-500 font-light leading-relaxed">
                      Se você já avisou o barbeiro, clique no botão abaixo para <strong className="text-red-500 font-medium">confirmar o cancelamento</strong> no sistema.
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={finalizeCancel}
                      disabled={deletingId !== null}
                      className={`w-full py-5 rounded-2xl font-sans text-xs uppercase tracking-[0.3em] font-bold transition-all shadow-xl ${
                        deletingId !== null 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20'
                      }`}
                    >
                      {deletingId !== null ? 'Cancelando...' : 'Confirmar Cancelamento'}
                    </button>
                    <button 
                      onClick={() => setCancelWaSent(false)}
                      className="text-[10px] uppercase tracking-widest font-bold text-gray-400 hover:text-accent"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMyBookingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMyBookingsModalOpen(false)}
              className="absolute inset-0 bg-text-base/60 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-bg-base w-full max-w-lg rounded-[40px] p-8 md:p-12 relative z-10 border border-border-base shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-bl-full -mr-10 -mt-10 opacity-50" />
              
              <button 
                onClick={() => setIsMyBookingsModalOpen(false)}
                className="absolute top-8 right-8 text-gray-400 hover:text-primary transition-colors z-20"
              >
                <X size={28} />
              </button>

              <div className="space-y-10 relative z-10">
                <div className="space-y-3">
                  <h3 className="text-4xl font-serif italic text-text-base">Meus Agendamentos</h3>
                  <div className="w-12 h-1 bg-primary" />
                  <p className="text-[10px] uppercase tracking-widest text-accent font-bold">
                    {myBookingsDetails.length === 0 ? 'Nenhum agendamento encontrado' : `${myBookingsDetails.length} agendamento(s)`}
                  </p>
                </div>

                <div className="space-y-6">
                  {myBookingsDetails.map((booking) => (
                    <div 
                      key={booking.id}
                      className="p-6 bg-white border border-border-base rounded-3xl space-y-4 hover:shadow-md transition-shadow group"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent">{booking.serviceName}</p>
                          </div>
                          <p className="font-serif text-xl text-primary">{booking.price}</p>
                          {booking.userIP && (
                            <p className="text-[9px] text-gray-400 mt-2 font-mono opacity-60">ID: {booking.userIP}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-text-base">{booking.date.split('-').reverse().join('/')}</p>
                          <p className="text-xs text-accent font-medium">{booking.time}</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border-base/50 flex flex-col gap-3">
                        {canCancel(booking.date) ? (
                          <button 
                            disabled={deletingId !== null}
                            onClick={() => handleCancelInitiate(booking)}
                            className={`w-full py-3 rounded-2xl text-[10px] uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2 ${
                              deletingId === booking.id 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'
                            }`}
                          >
                            {deletingId === booking.id ? (
                              <>Processando...</>
                            ) : (
                              <><X size={12} /> Cancelar Agendamento</>
                            )}
                          </button>
                        ) : (
                          <div className="w-full bg-gray-50 text-gray-400 py-3 rounded-2xl text-[9px] uppercase tracking-widest font-bold text-center italic">
                            Cancelamento indisponível (Prazo excedido)
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {myBookingsDetails.length === 0 && (
                    <div className="py-12 text-center space-y-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                        <Calendar className="text-gray-300" size={32} />
                      </div>
                      <p className="text-sm text-gray-400 font-light italic">
                        Você ainda não realizou nenhum agendamento neste dispositivo.
                      </p>
                      <button 
                        onClick={() => { setIsMyBookingsModalOpen(false); setIsBookingModalOpen(true); }}
                        className="bg-primary text-white px-8 py-3 rounded-full text-[10px] uppercase tracking-widest font-bold"
                      >
                        Agendar agora
                      </button>
                    </div>
                  )}

                  <div className="pt-10 mt-10 border-t border-border-base border-dashed text-center">
                    <p className="text-[9px] uppercase tracking-widest text-gray-300 font-bold mb-4">Administração</p>
                    <button 
                      onClick={wipeAllBookings}
                      className="text-[9px] uppercase tracking-widest font-bold text-red-300 hover:text-red-500 transition-colors"
                    >
                      Zerar Agenda (Geral)
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E8E4D9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #8C7B60; }
        
        @theme {
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
        }
      `}} />
    </div>
  );
}
