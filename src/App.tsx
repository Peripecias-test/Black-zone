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
  ChevronRight,
  Menu,
  X,
  Star,
  Check
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Booking State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [step, setStep] = useState(1); // 1: Service Selection, 2: Date Selection, 3: Time Selection, 4: Confirmation
  const [selectedService, setSelectedService] = useState<{name: string, price: string} | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  
  // New State for persistence
  const [bookings, setBookings] = useState<{date: string, time: string}[]>([]);

  // Helpers for Calendar
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  
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
    
    // Real-time listener for bookings
    const unsubscribe = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({
        date: doc.data().date,
        time: doc.data().time
      }));
      setBookings(bookingsData);
    }, (error) => {
      console.error("Erro ao carregar agendamentos do Firestore:", error);
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      unsubscribe();
    };
  }, []);

  const navLinks = [
    { name: 'Início', href: '#home' },
    { name: 'Serviços', href: '#services' },
    { name: 'Quem Somos', href: '#about' },
    { name: 'Localização', onClick: () => setIsMapModalOpen(true) },
  ];

  const isTimeOccupied = (dateStr: string, time: string) => {
    return bookings.some(b => b.date === dateStr && b.time === time);
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
  };

  const handleBookingStart = (service: {name: string, price: string}) => {
    setSelectedService(service);
    setStep(2);
    setIsBookingModalOpen(true);
  };

  const confirmBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime) {
      alert("Por favor, selecione todos os campos antes de finalizar.");
      return;
    }
    
    const dateStr = formatDate(selectedDate);
    const readableDate = selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    
    try {
      // Create a unique ID for the slot to prevent duplicates (blocking)
      const bookingId = `${dateStr}_${selectedTime.replace(':', '')}`;
      
      const bookingData = {
        serviceName: selectedService.name,
        price: selectedService.price,
        date: dateStr,
        time: selectedTime,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'bookings', bookingId), bookingData);

      // Formatting message for WhatsApp
      // Using plain labels to avoid encoding issues with complex emojis in some environments
      const message = [
        "Olá, gostaria de confirmar o agendamento:",
        "",
        `DATA: ${readableDate}`,
        `HORA: ${String(selectedTime)}`,
        `SERVICO: ${String(selectedService.name)}`,
        `VALOR: ${String(selectedService.price)}`,
        "",
        "Obrigado!"
      ].join("\n");

      const whatsappUrl = `https://wa.me/5511995202058?text=${encodeURIComponent(message)}`;
      
      // Try to open WhatsApp
      const win = window.open(whatsappUrl, '_blank');
      if (!win) {
         // Fallback if blocked
         window.location.href = whatsappUrl;
      }
      
      // Reset
      resetBooking();

    } catch (error: any) {
      if (error.code === 'permission-denied') {
        alert("Ops! Parece que este horário acabou de ser preenchido por outra pessoa ou houve um erro de validação. Por favor, escolha outro horário.");
      } else {
        console.error("Erro ao realizar agendamento:", error);
        alert("Ocorreu um erro ao salvar seu agendamento. Verifique sua conexão e tente novamente.");
      }
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
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-50 bg-bg-base flex flex-col items-center justify-center gap-10 md:hidden"
          >
            <button className="absolute top-8 right-8 text-text-base" onClick={() => setIsMenuOpen(false)}>
              <X size={32} />
            </button>
            <div className="flex flex-col items-center gap-8">
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
                  className="text-4xl font-serif italic text-accent hover:text-primary transition-colors cursor-pointer"
                >
                  {link.name}
                </a>
              ))}
            </div>
            <button 
              onClick={() => { setStep(1); setIsBookingModalOpen(true); setIsMenuOpen(false); }}
              className="bg-primary text-white px-12 py-4 rounded-sm font-sans text-sm uppercase tracking-[0.2em] font-bold"
            >
              Agendar Horário
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section id="home" className="relative h-[85vh] flex items-center justify-center overflow-hidden bg-bg-base border-b border-border-base">
        <div className="container mx-auto px-6 grid md:grid-cols-2 gap-12 items-center h-full">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <span className="text-accent font-bold tracking-[0.4em] uppercase text-[10px]">Excelência em Imagem</span>
              <h2 className="text-6xl md:text-8xl font-serif font-medium leading-[1.05] tracking-tight text-text-base">
                O seu estilo <br />é a sua <span className="italic text-accent underline decoration-border-base decoration-offset-8">história</span>.
              </h2>
              <p className="font-sans text-lg text-gray-500 max-w-md leading-relaxed font-light">
                Resgatando a tradição da barbearia clássica com um toque de modernidade. Um espaço dedicado ao homem de bom gosto.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 pt-4">
              <button 
                onClick={() => { setStep(1); setIsBookingModalOpen(true); }}
                className="bg-primary text-white px-10 py-5 font-sans text-sm uppercase tracking-widest hover:bg-primary/95 transition-all rounded-sm flex items-center justify-center gap-3 shadow-2xl shadow-primary/20"
              >
                <Calendar size={18} /> Agendar Agora
              </button>
              <div className="flex items-center gap-4 px-2">
                <div className="w-12 h-12 rounded-full border border-border-base flex items-center justify-center italic text-lg font-serif">BZ</div>
                <p className="font-sans text-[10px] uppercase tracking-widest text-accent font-bold leading-tight">
                  Tradição em <br />cada movimento
                </p>
              </div>
            </div>
          </motion.div>

          <div className="hidden md:block relative h-full">
            <div className="absolute inset-y-12 right-0 w-full bg-white rounded-l-[200px] shadow-sm border border-border-base overflow-hidden">
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
      <section id="about" className="py-32 bg-bg-base border-y border-border-base">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <div className="space-y-10">
              <span className="text-accent font-bold tracking-[0.3em] uppercase text-[10px]">Nossa História</span>
              <h2 className="text-5xl md:text-6xl font-serif font-medium leading-tight text-text-base">Quem Somos</h2>
              <div className="space-y-6 text-gray-500 font-light leading-relaxed text-lg">
                <p>
                  A Barbearia Black Zone nasceu com o desejo de proporcionar uma <strong className="text-primary font-medium italic underline decoration-border-base decoration-4 decoration-offset-4">experiência única de atendimento</strong> a um preço justo.
                </p>
                <p>
                  Fundada em 2020, rapidamente conquistamos quem busca um corte impecável em um ambiente sofisticado e acolhedor. Para nós, cada corte de cabelo é uma oportunidade de transformar o dia de alguém.
                </p>
                <p className="font-serif text-3xl italic text-primary pt-4">Sonhe Grande!</p>
              </div>
            </div>
            
            <div className="relative p-10 bg-white border border-border-base rounded-[40px] shadow-sm">
               <div className="absolute top-0 right-0 w-32 h-32 bg-bg-base rounded-bl-full -mr-10 -mt-10 opacity-50"></div>
               <img 
                src="https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=800&auto=format&fit=crop" 
                className="grayscale rounded-3xl border border-border-base relative z-10" 
                alt="Barber"
               />
               <div className="absolute -bottom-6 -left-6 bg-primary text-white p-6 rounded-2xl z-20 shadow-xl max-w-[200px]">
                 <Star className="mb-2 fill-white text-white" />
                 <p className="font-bold text-sm uppercase tracking-widest leading-tight">Excelência Certificada</p>
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
                    className="w-full py-5 bg-text-base text-white text-[10px] uppercase tracking-[0.2em] font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-primary transition-all shadow-xl group"
                  >
                    Como Chegar <ExternalLink size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
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
                  <div className="w-24 h-24 bg-primary/5 text-primary rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/10">
                    <Check size={48} strokeWidth={1.5} />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-4xl font-serif italic">Resumo do pedido</h3>
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
                      onClick={confirmBooking}
                      className="w-full bg-primary text-white py-6 rounded-2xl font-sans text-xs uppercase tracking-[0.3em] font-bold hover:bg-primary/95 transition-all shadow-xl shadow-primary/20"
                    >
                      Finalizar no WhatsApp
                    </button>
                    <button 
                      onClick={() => setStep(3)}
                      className="text-[10px] uppercase tracking-widest font-bold text-gray-400 hover:text-accent"
                    >
                      Voltar e alterar horário
                    </button>
                  </div>
                </div>
              )}
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
