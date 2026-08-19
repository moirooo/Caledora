/*
  ORIA BANK — Application bancaire premium (prête pour Replit)
  ================================================================
  Prérequis dans le projet Replit :
    - React 18+
    - Tailwind CSS déjà configuré (tailwind.config.js + directives
      @tailwind base/components/utilities dans votre index.css)
    - lucide-react  →  npm install lucide-react

  Logo :
    - Placez le fichier logo fourni dans /public/oriabank.png
    - <OriaLogo /> l'affiche via <img src="/oriabank.png" ... />
      Vous pouvez aussi passer une autre source : <OriaLogo src="/autre.png" />

  Ce fichier est autonome : copiez-le tel quel dans src/App.jsx.
  ================================================================
*/

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Home,
  CreditCard,
  Send,
  PieChart,
  Wallet,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  Search,
  Bell,
  X,
  Sparkles,
  ArrowDownLeft,
  TrendingUp,
  Snowflake,
  Wifi,
  Globe,
  Banknote,
  RefreshCw,
  Landmark,
  Plane,
  UtensilsCrossed,
  Music,
  ShieldCheck,
  ArrowLeft,
  ArrowLeftRight,
  ChevronRight,
  Share2,
  CheckCircle2,
  MapPin,
  Lock,
  KeyRound,
  Clock,
} from "lucide-react";

/* ============================================================
   LOGO — composant image (aucun SVG codé en dur)
   ============================================================ */
function OriaLogo({ src = "/images/oriabank.png", className = "h-7 w-auto object-contain" }) {
  return <img src={src} alt="Oria Bank" className={className} draggable={false} />;
}

/* ============================================================
   HELPERS
   ============================================================ */
function formatAmount(value, currency = "EUR") {
  const formatted = Math.abs(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (currency === "EUR") return `${formatted} €`;
  if (currency === "USD") return `$ ${formatted}`;
  if (currency === "GBP") return `£ ${formatted}`;
  return formatted;
}

function formatSigned(value, currency = "EUR") {
  const sign = value > 0 ? "+ " : value < 0 ? "− " : "";
  return sign + formatAmount(value, currency);
}

function parseAmount(str) {
  return parseFloat((str || "0").replace(",", ".")) || 0;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function genRef() {
  return "OR-" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

const RATES = { EUR: 1, USD: 1.09, GBP: 0.86 };
function toEUR(amount, currency) {
  if (currency === "EUR") return amount;
  return amount / RATES[currency];
}
function fromEUR(amountEur, currency) {
  if (currency === "EUR") return amountEur;
  return amountEur * RATES[currency];
}

/* ============================================================
   STATIC DATA
   ============================================================ */
const INITIAL_TRANSACTIONS = [
  { id: 1, name: "Caledora Airways", category: "Vol international", amount: -420.0, icon: Plane, date: "Aujourd'hui", time: "14:32", status: "Validé", reference: "OR-7F2K9X31" },
  { id: 2, name: "Vusion Intelligence", category: "Virement salaire", amount: 3200.0, icon: Landmark, date: "01 août", time: "09:00", status: "Validé", reference: "OR-4B81QZ0M" },
  { id: 3, name: "La Riva Restaurant", category: "Restauration", amount: -86.5, icon: UtensilsCrossed, date: "Hier", time: "20:14", status: "Validé", reference: "OR-9K3P2L7T" },
  { id: 4, name: "Spotify Premium", category: "Abonnement", amount: -10.99, icon: Music, date: "28 juillet", time: "03:00", status: "En attente", reference: "OR-1X7W4D9C" },
];

const INITIAL_CONTACTS = [
  { id: 1, name: "Camille Faure", initials: "CF", color: "#D49B28" },
  { id: 2, name: "Thomas Nguyen", initials: "TN", color: "#09333E" },
  { id: 3, name: "Léa Bertrand", initials: "LB", color: "#10B981" },
  { id: 4, name: "Hugo Castel", initials: "HC", color: "#EF4444" },
];

const INITIAL_VAULTS = [
  { id: 1, name: "Voyage & Vacances", current: 2450, target: 3500, icon: MapPin, type: "goal" },
  { id: 2, name: "Réserve Rémunérée", current: 12000, rate: 3.85, icon: TrendingUp, type: "investment" },
];

const TRANSFER_CATEGORIES = ["Loyer", "Alimentation", "Loisirs", "Cadeau", "Voyage", "Autre"];

const CHART_DATA = {
  "7d": [
    { label: "Lun", value: 62 },
    { label: "Mar", value: 38 },
    { label: "Mer", value: 91 },
    { label: "Jeu", value: 45 },
    { label: "Ven", value: 120 },
    { label: "Sam", value: 78 },
    { label: "Dim", value: 34 },
  ],
  month: [
    { label: "S1", value: 480 },
    { label: "S2", value: 610 },
    { label: "S3", value: 395 },
    { label: "S4", value: 700 },
  ],
  year: [
    { label: "Jan", value: 2100 },
    { label: "Fév", value: 1850 },
    { label: "Mar", value: 2400 },
    { label: "Avr", value: 1980 },
    { label: "Mai", value: 2650 },
    { label: "Juin", value: 2200 },
    { label: "Juil", value: 2480 },
    { label: "Août", value: 2480 },
    { label: "Sep", value: 1900 },
    { label: "Oct", value: 2050 },
    { label: "Nov", value: 2300 },
    { label: "Déc", value: 2900 },
  ],
};
const PERIOD_SCALE = { "7d": 1 / 4.33, month: 1, year: 12 };

const CATEGORY_BREAKDOWN = [
  { name: "Restauration & Sorties", pct: 34, amount: 845.0, emoji: "🍽️", barClass: "bg-[#D49B28]" },
  { name: "Voyages & Mobilité", pct: 28, amount: 690.0, emoji: "✈️", barClass: "bg-[#1B6E7D]" },
  { name: "Factures & Abonnements", pct: 22, amount: 550.0, emoji: "🏠", barClass: "bg-[#8DA4AF]" },
  { name: "Shopping & Tech", pct: 16, amount: 395.0, emoji: "🛍️", barClass: "bg-emerald-500" },
];

const NAV_ITEMS = [
  { id: "home", label: "Accueil", icon: Home },
  { id: "cards", label: "Cartes", icon: CreditCard },
  { id: "transfers", label: "Virements", icon: Send },
  { id: "analytics", label: "Budget", icon: PieChart },
  { id: "vaults", label: "Coffres", icon: Wallet },
];

/* ============================================================
   REUSABLE UI PRIMITIVES
   ============================================================ */
function Bar({ percent, barClass = "bg-[#D49B28]", height = "h-2" }) {
  return (
    <div className={`w-full ${height} rounded-full overflow-hidden bg-white/10`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${barClass}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-300 ${
        checked ? "bg-[#D49B28]" : "bg-white/15"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

function FieldLabel({ children }) {
  return <label className="mb-1.5 block text-[11px] font-medium text-[#8DA4AF]">{children}</label>;
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-[#163845]/60 bg-[#081418] px-3.5 py-3 text-sm text-white outline-none placeholder-[#8DA4AF]/50 transition-colors focus:border-[#D49B28]/50"
    />
  );
}

function GoldButton({ children, onClick, disabled = false, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-2xl bg-gradient-to-r from-[#D49B28] to-[#C58B1E] py-4 text-sm font-bold text-[#051C23] transition-transform active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border border-[#163845]/60 bg-[#0B1E26] p-5 sm:max-w-sm sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
            <X size={14} className="text-[#8DA4AF]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ visible, message }) {
  return (
    <div
      className={`fixed left-1/2 top-4 z-[100] -translate-x-1/2 transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-6 opacity-0"
      }`}
    >
      <div className="flex items-center gap-2 rounded-full border border-[#D49B28]/40 bg-[#0B1E26]/95 px-5 py-3 shadow-2xl backdrop-blur-xl">
        <CheckCircle2 size={16} className="text-[#D49B28]" />
        <span className="text-sm font-medium text-white">{message}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const validated = status === "Validé";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        validated ? "bg-emerald-500/15 text-emerald-400" : "bg-[#F59E0B]/15 text-[#F59E0B]"
      }`}
    >
      {validated ? <CheckCircle2 size={10} /> : <Clock size={10} />}
      {status}
    </span>
  );
}

/* ============================================================
   MAIN APP
   ============================================================ */
export default function App() {
  const [activeTab, setActiveTab] = useState("home");

  // Home
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [balances, setBalances] = useState({ EUR: 34680.5, USD: 4120.0, GBP: 1850.2 });
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [search, setSearch] = useState("");
  const [txFilter, setTxFilter] = useState("all");
  const [notifOpen, setNotifOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  // Toast
  const [toast, setToast] = useState({ visible: false, message: "" });
  const toastTimeoutRef = useRef(null);

  // Modals
  const [modal, setModal] = useState(null);
  const [modalPayload, setModalPayload] = useState(null);
  const [ibanRevealed, setIbanRevealed] = useState(false);
  const [deposit, setDeposit] = useState({ method: "card", amount: "" });
  const [newContactName, setNewContactName] = useState("");
  const [newVaultForm, setNewVaultForm] = useState({ name: "", target: "" });
  const [converter, setConverter] = useState({ from: "EUR", to: "USD", amount: "100" });
  const [converterError, setConverterError] = useState("");

  // Cards
  const [cardView, setCardView] = useState("metal");
  const [cardFrozen, setCardFrozen] = useState(false);
  const [cvvRevealed, setCvvRevealed] = useState(false);
  const [pinRevealed, setPinRevealed] = useState(false);
  const [virtualCard, setVirtualCard] = useState({ number: "5421 8834 0192 7734", cvv: "071", expiry: "12/27" });
  const [vcCopied, setVcCopied] = useState(false);
  const [cardToggles, setCardToggles] = useState({ contactless: true, foreignOnline: true, atm: true });

  // Transfers
  const [transferMode, setTransferMode] = useState("friends");
  const [contacts, setContacts] = useState(INITIAL_CONTACTS);
  const [selectedContactId, setSelectedContactId] = useState(1);
  const [transferForm, setTransferForm] = useState({ amount: "", note: "", category: "", beneficiaryName: "", beneficiaryIban: "" });
  const [transferStatus, setTransferStatus] = useState("idle");
  const [transferError, setTransferError] = useState("");

  // Analytics
  const [period, setPeriod] = useState("month");

  // Vaults
  const [vaults, setVaults] = useState(INITIAL_VAULTS);
  const [roundUp, setRoundUp] = useState(false);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  function showToast(message) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, message });
    toastTimeoutRef.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2800);
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (txFilter === "expense" && tx.amount >= 0) return false;
      if (txFilter === "income" && tx.amount <= 0) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const amountStr = Math.abs(tx.amount).toFixed(2).replace(".", ",");
      return tx.name.toLowerCase().includes(q) || amountStr.includes(q);
    });
  }, [transactions, txFilter, search]);

  const feeInfo = useMemo(() => {
    const amt = parseAmount(transferForm.amount);
    if (transferMode === "friends") return { fee: "0,00 €", execution: "Exécution instantanée" };
    if (transferMode === "sepa") return { fee: "0,00 €", execution: "Sous 1 jour ouvré" };
    const fee = Math.max(2.5, amt * 0.006);
    return {
      fee: `${fee.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
      execution: "Sous 2 à 4 jours ouvrés",
    };
  }, [transferMode, transferForm.amount]);

  const convertedAmount = useMemo(() => {
    const amt = parseAmount(converter.amount);
    const eur = toEUR(amt, converter.from);
    return formatAmount(fromEUR(eur, converter.to), converter.to);
  }, [converter]);

  /* ---------------- Handlers ---------------- */
  function closeModal() {
    setModal(null);
    setModalPayload(null);
    setIbanRevealed(false);
    setConverterError("");
  }

  function toggleNotif() {
    setNotifOpen((v) => !v);
    setHasUnread(false);
  }

  function copyIbanQuick() {
    const iban = "FR76 3000 4000 2800 0107 8523 964";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(iban).catch(() => {});
    }
    showToast("IBAN copié dans le presse-papier");
  }

  function handleDeposit() {
    const amt = parseAmount(deposit.amount);
    if (!amt || amt <= 0) return;
    setBalances((b) => ({ ...b, EUR: b.EUR + amt }));
    setTransactions((t) => [
      {
        id: Date.now(),
        name: `Dépôt · ${deposit.method === "applepay" ? "Apple Pay" : "Carte bancaire"}`,
        category: "Dépôt",
        amount: amt,
        icon: Plus,
        date: "Aujourd'hui",
        time: nowTime(),
        status: "Validé",
        reference: genRef(),
      },
      ...t,
    ]);
    showToast(`Dépôt de ${formatAmount(amt, "EUR")} effectué`);
    setDeposit({ method: "card", amount: "" });
    closeModal();
  }

  function handleConfirmTransfer() {
    const amt = parseAmount(transferForm.amount);
    if (!amt || amt <= 0) {
      setTransferError("Veuillez saisir un montant valide.");
      return;
    }
    if (amt > balances.EUR) {
      setTransferError("Solde insuffisant sur votre compte EUR.");
      return;
    }
    setTransferError("");
    const recipientName =
      transferMode === "friends"
        ? contacts.find((c) => c.id === selectedContactId)?.name || "Contact Oria"
        : transferForm.beneficiaryName || "Bénéficiaire";
    const categoryLabel =
      transferForm.category ||
      (transferMode === "friends" ? "Virement Oria" : transferMode === "sepa" ? "Virement SEPA" : "Virement international");

    setBalances((b) => ({ ...b, EUR: b.EUR - amt }));
    setTransactions((t) => [
      {
        id: Date.now(),
        name: recipientName,
        category: categoryLabel,
        amount: -amt,
        icon: Send,
        date: "Aujourd'hui",
        time: nowTime(),
        status: transferMode === "friends" ? "Validé" : "En attente",
        reference: genRef(),
      },
      ...t,
    ]);
    setTransferStatus("success");
    showToast(
      transferMode === "friends"
        ? `Virement instantané de ${formatAmount(amt, "EUR")} exécuté`
        : `Virement de ${formatAmount(amt, "EUR")} envoyé`
    );
    setTimeout(() => {
      setTransferStatus("idle");
      setTransferForm({ amount: "", note: "", category: "", beneficiaryName: "", beneficiaryIban: "" });
    }, 2000);
  }

  function handleCreateVault() {
    const target = parseAmount(newVaultForm.target);
    if (!newVaultForm.name.trim() || !target) return;
    setVaults((v) => [...v, { id: Date.now(), name: newVaultForm.name.trim(), current: 0, target, icon: MapPin, type: "goal" }]);
    showToast(`Coffre « ${newVaultForm.name.trim()} » créé`);
    setNewVaultForm({ name: "", target: "" });
    closeModal();
  }

  function handleConvert() {
    const amt = parseAmount(converter.amount);
    if (amt <= 0) {
      setConverterError("Montant invalide.");
      return;
    }
    if (balances[converter.from] < amt) {
      setConverterError(`Solde ${converter.from} insuffisant.`);
      return;
    }
    const eur = toEUR(amt, converter.from);
    const result = fromEUR(eur, converter.to);
    setBalances((b) => ({ ...b, [converter.from]: b[converter.from] - amt, [converter.to]: b[converter.to] + result }));
    showToast(`Conversion de ${converter.from} vers ${converter.to} effectuée`);
    setConverterError("");
    closeModal();
  }

  function handleAddContact() {
    if (!newContactName.trim()) return;
    const palette = ["#D49B28", "#09333E", "#10B981", "#EF4444", "#1B6E7D"];
    const initials = newContactName.trim().split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
    setContacts((c) => [...c, { id: Date.now(), name: newContactName.trim(), initials, color: palette[c.length % palette.length] }]);
    showToast(`${newContactName.trim()} ajouté à vos contacts`);
    setNewContactName("");
    closeModal();
  }

  function regenerateVirtualCard() {
    const groups = Array.from({ length: 4 }, () => Math.floor(1000 + Math.random() * 9000)).join(" ");
    const cvv = String(Math.floor(100 + Math.random() * 900));
    setVirtualCard((s) => ({ ...s, number: groups, cvv }));
    showToast("Nouveau numéro de carte virtuelle généré");
  }

  function copyVirtualCardNumber() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(virtualCard.number).catch(() => {});
    }
    setVcCopied(true);
    showToast("Numéro de carte copié");
    setTimeout(() => setVcCopied(false), 1800);
  }

  function shareReceipt(tx) {
    const text = `ORIA BANK — Reçu de transaction\n${tx.name}\n${formatSigned(tx.amount, "EUR")}\nRéférence : ${tx.reference}\nStatut : ${tx.status}\nDate : ${tx.date} à ${tx.time}`;
    if (navigator.share) {
      navigator.share({ title: "Reçu Oria Bank", text }).catch(() => {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
      showToast("Reçu copié dans le presse-papier");
    }
  }

  /* ---------------- Render ---------------- */
  return (
    <div className="min-h-screen w-full bg-[#081418] flex justify-center">
      <div className="relative flex min-h-screen w-full max-w-md flex-col justify-between bg-[#050C0F] text-slate-100 shadow-2xl">
        <Toast visible={toast.visible} message={toast.message} />

        <div className="flex-1 overflow-y-auto pb-24">
          {/* ===================== HOME ===================== */}
          {activeTab === "home" && (
            <div>
              <div className="sticky top-0 z-30 border-b border-[#163845]/40 bg-[#050C0F]/85 px-5 pb-4 pt-6 backdrop-blur-xl">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <a
                      href="/"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#8DA4AF] transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <ArrowLeft size={14} />
                      ← Hub
                    </a>
                    <OriaLogo />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1 rounded-full border border-[#D49B28]/50 bg-[#0B1E26]/60 px-2.5 py-1">
                      <Sparkles size={11} className="text-[#D49B28]" />
                      <span className="text-[10px] font-semibold tracking-wide text-[#D49B28]">ORIA INFINITE</span>
                    </div>
                    <button
                      onClick={toggleNotif}
                      className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/5"
                    >
                      <Bell size={15} className="text-white" />
                      {hasUnread && (
                        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#EF4444] ring-2 ring-[#050C0F]" />
                      )}
                    </button>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#D49B28] to-[#C58B1E] p-[1.5px]">
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-[#09333E]">
                        <span className="text-[10px] font-bold text-white">JR</span>
                      </div>
                    </div>
                  </div>
                </div>

                {notifOpen && (
                  <div className="mb-4 rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 p-4 backdrop-blur-xl">
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#8DA4AF]">Notifications</p>
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2.5">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                          <ArrowDownLeft size={13} className="text-emerald-400" />
                        </div>
                        <p className="text-xs leading-relaxed text-white">
                          Virement reçu de <b>Vusion Intelligence</b> — 3 200,00 €
                        </p>
                      </div>
                      <div className="flex gap-2.5">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#D49B28]/15">
                          <Sparkles size={13} className="text-[#D49B28]" />
                        </div>
                        <p className="text-xs leading-relaxed text-white">
                          Le taux de votre Réserve Rémunérée passe à 3,85 % brut annuel.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Balance */}
                <div className="rounded-3xl border border-[#163845]/50 bg-[#0B1E26]/70 p-5 backdrop-blur-xl">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-[#8DA4AF]">Solde total disponible</span>
                    <button onClick={() => setBalanceVisible((v) => !v)}>
                      {balanceVisible ? <Eye size={15} className="text-[#8DA4AF]" /> : <EyeOff size={15} className="text-[#8DA4AF]" />}
                    </button>
                  </div>
                  <p className="tabular-nums font-mono mb-3 text-[34px] font-bold leading-none text-white">
                    {balanceVisible ? formatAmount(balances.EUR, "EUR") : "•••• ••• €"}
                  </p>
                  <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1">
                    <TrendingUp size={12} className="text-emerald-400" />
                    <span className="text-[11px] font-semibold text-emerald-400">+ 2 450,00 € (+7,6 %) ce mois</span>
                  </div>
                  <button
                    onClick={copyIbanQuick}
                    className="flex w-full items-center justify-between rounded-xl border border-[#163845]/50 bg-[#081418]/60 px-3.5 py-2.5"
                  >
                    <span className="text-[11px] text-[#8DA4AF]">FR76 3000 4000 ... • BIC : ORIACD2X</span>
                    <Copy size={13} className="text-[#D49B28]" />
                  </button>
                </div>

                {/* Quick actions */}
                <div className="mt-5 grid grid-cols-4 gap-2">
                  {[
                    { id: "deposit", label: "Déposer", icon: Plus, action: () => setModal("deposit") },
                    { id: "send", label: "Envoyer", icon: Send, action: () => setActiveTab("transfers") },
                    { id: "convert", label: "Convertir", icon: ArrowLeftRight, action: () => setActiveTab("vaults") },
                    { id: "rib", label: "RIB / Infos", icon: Landmark, action: () => setModal("iban") },
                  ].map((a) => {
                    const Icon = a.icon;
                    return (
                      <button key={a.id} onClick={a.action} className="flex flex-col items-center gap-2 transition-transform active:scale-90">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#163845]/50 bg-[#0B1E26]/70 backdrop-blur-xl">
                          <Icon size={19} className="text-[#D49B28]" strokeWidth={2.25} />
                        </div>
                        <span className="text-center text-[10px] leading-tight text-[#8DA4AF]">{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-5 pt-5">
                {/* Search */}
                <div className="relative mb-4">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8DA4AF]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par nom ou montant…"
                    className="w-full rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 py-3 pl-10 pr-4 text-sm text-white outline-none backdrop-blur-xl transition-colors placeholder-[#8DA4AF]/50 focus:border-[#D49B28]/50"
                  />
                </div>

                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[15px] font-bold text-white">Transactions récentes</h3>
                </div>
                <div className="mb-3 flex gap-2">
                  {[
                    { id: "all", label: "Tout" },
                    { id: "expense", label: "Dépenses" },
                    { id: "income", label: "Revenus" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setTxFilter(f.id)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                        txFilter === f.id ? "bg-[#D49B28] text-[#051C23]" : "bg-white/5 text-[#8DA4AF]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2.5">
                  {filteredTransactions.map((tx) => {
                    const Icon = tx.icon;
                    return (
                      <button
                        key={tx.id}
                        onClick={() => {
                          setModal("txdetail");
                          setModalPayload(tx);
                        }}
                        className="flex w-full items-center justify-between rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 p-3 backdrop-blur-xl transition-transform active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
                            <Icon size={17} className="text-white" />
                          </div>
                          <div className="text-left">
                            <p className="text-[13px] font-semibold text-white">{tx.name}</p>
                            <div className="flex items-center gap-1.5">
                              <p className="text-[11px] text-[#8DA4AF]">
                                {tx.category} · {tx.date}
                              </p>
                              <StatusBadge status={tx.status} />
                            </div>
                          </div>
                        </div>
                        <span className={`tabular-nums font-mono text-[13px] font-bold ${tx.amount > 0 ? "text-emerald-400" : "text-white"}`}>
                          {formatSigned(tx.amount, "EUR")}
                        </span>
                      </button>
                    );
                  })}
                  {filteredTransactions.length === 0 && (
                    <p className="py-8 text-center text-[12.5px] text-[#8DA4AF]">
                      {search.trim() ? `Aucun résultat pour « ${search} ».` : "Aucune transaction dans cette catégorie."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===================== CARDS ===================== */}
          {activeTab === "cards" && (
            <div className="px-5 pt-6">
              <h2 className="mb-5 text-xl font-bold text-white">Mes cartes</h2>

              <div className="mb-5 flex rounded-full bg-white/5 p-1">
                {[
                  { id: "metal", label: "Oria Metal Gold" },
                  { id: "virtual", label: "Carte Virtuelle Cyber" },
                ].map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setCardView(v.id)}
                    className={`flex-1 rounded-full py-2 text-[11.5px] font-semibold transition-colors ${
                      cardView === v.id ? "bg-[#D49B28] text-[#051C23]" : "text-[#8DA4AF]"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              {cardView === "metal" ? (
                <div
                  className={`relative mb-5 h-[200px] overflow-hidden rounded-3xl border p-5 transition-all duration-500 ${
                    cardFrozen ? "border-white/10 grayscale" : "border-[#D49B28]/40"
                  }`}
                  style={{ background: cardFrozen ? "linear-gradient(155deg, #2B2F33, #14171A)" : "linear-gradient(155deg, #09333E, #051C23)" }}
                >
                  <div className="flex items-center justify-between">
                    <OriaLogo className="h-5 w-auto object-contain opacity-90" />
                    <div className="h-6 w-8 rounded-md bg-gradient-to-br from-[#D49B28] to-[#C58B1E]" />
                  </div>
                  {cardFrozen && (
                    <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1">
                      <Lock size={10} className="text-white" />
                      <span className="text-[10px] font-semibold text-white">Verrouillée</span>
                    </div>
                  )}
                  <p className="tabular-nums font-mono mt-11 text-lg font-medium tracking-[3px] text-white">•••• •••• •••• 9042</p>
                  <div className="mt-5 flex items-center justify-between">
                    <div>
                      <p className="text-[8.5px] tracking-wide text-white/50">TITULAIRE</p>
                      <p className="text-[12.5px] font-semibold tracking-wide text-white">JULES RIVORY</p>
                    </div>
                    <div>
                      <p className="text-[8.5px] tracking-wide text-white/50">EXPIRE</p>
                      <p className="tabular-nums font-mono text-[12.5px] font-semibold text-white">08/29</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="relative mb-5 h-[200px] overflow-hidden rounded-3xl border border-[#D49B28]/40 p-5"
                  style={{ background: "linear-gradient(135deg, #0E2A33 0%, #16787F 45%, #D49B28 100%)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold tracking-wide text-white">ORIA CYBER</span>
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <button onClick={copyVirtualCardNumber} className="tabular-nums font-mono mt-11 flex items-center gap-2 text-[17px] font-medium tracking-[2px] text-white">
                    {virtualCard.number}
                    {vcCopied ? <Check size={13} /> : <Copy size={13} className="opacity-70" />}
                  </button>
                  <div className="mt-5 flex items-center justify-between">
                    <div>
                      <p className="text-[8.5px] text-white/60">CVV</p>
                      <p className="tabular-nums font-mono text-[12.5px] font-semibold text-white">{virtualCard.cvv}</p>
                    </div>
                    <div>
                      <p className="text-[8.5px] text-white/60">EXPIRE</p>
                      <p className="tabular-nums font-mono text-[12.5px] font-semibold text-white">{virtualCard.expiry}</p>
                    </div>
                    <button
                      onClick={regenerateVirtualCard}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/25 transition-transform active:scale-90"
                    >
                      <RefreshCw size={12} className="text-white" />
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-4 rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 p-4 backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-[#8DA4AF]">Plafond mensuel</span>
                  <span className="tabular-nums font-mono text-xs font-semibold text-white">6 200 € / 15 000 €</span>
                </div>
                <Bar percent={(6200 / 15000) * 100} />
              </div>

              <div className="mb-3 flex items-center gap-2">
                <KeyRound size={14} className="text-[#D49B28]" />
                <span className="text-xs font-semibold text-white">Codes secrets</span>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCvvRevealed((v) => !v)}
                  className="rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 p-4 text-left backdrop-blur-xl"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] text-[#8DA4AF]">CVV</span>
                    {cvvRevealed ? <EyeOff size={13} className="text-[#8DA4AF]" /> : <Eye size={13} className="text-[#8DA4AF]" />}
                  </div>
                  <p className="tabular-nums font-mono text-lg font-bold tracking-widest text-[#D49B28]">
                    {cvvRevealed ? "842" : "•••"}
                  </p>
                </button>
                <button
                  onClick={() => setPinRevealed((v) => !v)}
                  className="rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 p-4 text-left backdrop-blur-xl"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] text-[#8DA4AF]">Code PIN</span>
                    {pinRevealed ? <EyeOff size={13} className="text-[#8DA4AF]" /> : <Eye size={13} className="text-[#8DA4AF]" />}
                  </div>
                  <p className="tabular-nums font-mono text-lg font-bold tracking-widest text-[#D49B28]">
                    {pinRevealed ? "4471" : "••••"}
                  </p>
                </button>
              </div>

              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck size={14} className="text-[#D49B28]" />
                <span className="text-xs font-semibold text-white">Contrôles de sécurité</span>
              </div>
              <div className="mb-6 overflow-hidden rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 backdrop-blur-xl">
                <button
                  onClick={() => setCardFrozen((v) => !v)}
                  className="flex w-full items-center justify-between border-b border-[#163845]/50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Snowflake size={16} className={cardFrozen ? "text-[#D49B28]" : "text-[#8DA4AF]"} />
                    <span className="text-[13px] text-white">{cardFrozen ? "Dégeler la carte" : "Geler la carte"}</span>
                  </div>
                  <ChevronRight size={16} className="text-[#8DA4AF]" />
                </button>
                <div className="flex w-full items-center justify-between border-b border-[#163845]/50 p-4">
                  <div className="flex items-center gap-3">
                    <Wifi size={16} className="text-[#8DA4AF]" />
                    <span className="text-[13px] text-white">Sans contact & Apple Pay</span>
                  </div>
                  <ToggleSwitch checked={cardToggles.contactless} disabled={cardFrozen} onChange={(v) => setCardToggles((s) => ({ ...s, contactless: v }))} />
                </div>
                <div className="flex w-full items-center justify-between border-b border-[#163845]/50 p-4">
                  <div className="flex items-center gap-3">
                    <Globe size={16} className="text-[#8DA4AF]" />
                    <span className="text-[13px] text-white">Paiements à l'étranger & en ligne</span>
                  </div>
                  <ToggleSwitch checked={cardToggles.foreignOnline} disabled={cardFrozen} onChange={(v) => setCardToggles((s) => ({ ...s, foreignOnline: v }))} />
                </div>
                <div className="flex w-full items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Banknote size={16} className="text-[#8DA4AF]" />
                    <span className="text-[13px] text-white">Retraits aux distributeurs</span>
                  </div>
                  <ToggleSwitch checked={cardToggles.atm} disabled={cardFrozen} onChange={(v) => setCardToggles((s) => ({ ...s, atm: v }))} />
                </div>
              </div>
            </div>
          )}

          {/* ===================== TRANSFERS ===================== */}
          {activeTab === "transfers" && (
            <div className="px-5 pt-6">
              <h2 className="mb-5 text-xl font-bold text-white">Virements</h2>

              <div className="mb-5 flex rounded-full bg-white/5 p-1">
                {[
                  { id: "friends", label: "Amis Oria" },
                  { id: "sepa", label: "SEPA" },
                  { id: "international", label: "International" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setTransferMode(m.id);
                      setTransferError("");
                    }}
                    className={`flex-1 rounded-full py-2 text-[11px] font-semibold transition-colors ${
                      transferMode === m.id ? "bg-[#D49B28] text-[#051C23]" : "text-[#8DA4AF]"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="-mt-3 mb-5 text-center text-[10.5px] text-[#8DA4AF]">
                {transferMode === "friends" ? "Virement instantané entre membres Oria" : transferMode === "sepa" ? "Virement Bancaire (SEPA)" : "Virement International"}
              </p>

              {transferMode === "friends" ? (
                <>
                  <h3 className="mb-3 text-[13px] font-bold text-white">Contacts récents</h3>
                  <div className="mb-6 flex gap-4 overflow-x-auto pb-1">
                    {contacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedContactId(c.id)}
                        className="flex flex-shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95"
                      >
                        <div
                          className="relative flex h-12 w-12 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: c.color,
                            border: selectedContactId === c.id ? "2px solid #D49B28" : "2px solid transparent",
                          }}
                        >
                          <span className="text-sm font-bold text-white">{c.initials}</span>
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#D49B28] ring-2 ring-[#050C0F]" />
                        </div>
                        <span className="max-w-[60px] text-center text-[10px] text-[#8DA4AF]">{c.name.split(" ")[0]}</span>
                      </button>
                    ))}
                    <button onClick={() => setModal("addcontact")} className="flex flex-shrink-0 flex-col items-center gap-1.5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-[#8DA4AF]/50 bg-white/5">
                        <Plus size={16} className="text-[#8DA4AF]" />
                      </div>
                      <span className="text-[10px] text-[#8DA4AF]">Nouveau</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="mb-6 flex flex-col gap-3">
                  <div>
                    <FieldLabel>Nom du bénéficiaire</FieldLabel>
                    <TextInput
                      value={transferForm.beneficiaryName}
                      onChange={(e) => setTransferForm((s) => ({ ...s, beneficiaryName: e.target.value }))}
                      placeholder="Ex : Marion Dubreuil"
                    />
                  </div>
                  <div>
                    <FieldLabel>IBAN {transferMode === "international" ? "/ SWIFT" : ""}</FieldLabel>
                    <TextInput
                      value={transferForm.beneficiaryIban}
                      onChange={(e) => setTransferForm((s) => ({ ...s, beneficiaryIban: e.target.value }))}
                      placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                    />
                  </div>
                </div>
              )}

              <div className="mb-4 rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 p-5 backdrop-blur-xl">
                <FieldLabel>Montant à envoyer</FieldLabel>
                <input
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm((s) => ({ ...s, amount: e.target.value.replace(/[^0-9.,]/g, "") }))}
                  placeholder="0,00 €"
                  inputMode="decimal"
                  className="tabular-nums font-mono w-full bg-transparent text-3xl font-bold text-white outline-none placeholder-white/20"
                />
                <div className="mt-3 flex items-center justify-between border-t border-[#163845]/50 pt-2.5">
                  <span className="text-[11px] text-[#8DA4AF]">Frais Oria : {feeInfo.fee}</span>
                  <span className="text-[11px] font-semibold text-emerald-400">{feeInfo.execution}</span>
                </div>
              </div>

              <div className="mb-4">
                <FieldLabel>Motif (optionnel)</FieldLabel>
                <TextInput
                  value={transferForm.note}
                  onChange={(e) => setTransferForm((s) => ({ ...s, note: e.target.value }))}
                  placeholder="Loyer, Restaurant, Cadeau…"
                />
              </div>

              <div className="mb-6">
                <FieldLabel>Catégorie</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {TRANSFER_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setTransferForm((s) => ({ ...s, category: s.category === cat ? "" : cat }))}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                        transferForm.category === cat ? "bg-[#D49B28] text-[#051C23]" : "border border-[#163845]/60 text-[#8DA4AF]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleConfirmTransfer}
                disabled={transferStatus === "success"}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-transform active:scale-[0.98] ${
                  transferStatus === "success" ? "bg-emerald-500 text-white" : "bg-gradient-to-r from-[#D49B28] to-[#C58B1E] text-[#051C23]"
                }`}
              >
                {transferStatus === "success" ? (
                  <>
                    <Check size={17} /> Virement envoyé
                  </>
                ) : (
                  <>Confirmer le virement de {transferForm.amount ? transferForm.amount : "0,00"} €</>
                )}
              </button>
              {transferError && <p className="mt-2.5 text-center text-xs text-[#EF4444]">{transferError}</p>}
            </div>
          )}

          {/* ===================== ANALYTICS ===================== */}
          {activeTab === "analytics" && (
            <div className="px-5 pt-6">
              <h2 className="mb-5 text-xl font-bold text-white">Budget & Statistiques</h2>

              <div className="mb-6 flex rounded-full bg-white/5 p-1">
                {[
                  { id: "7d", label: "7 jours" },
                  { id: "month", label: "Mois en cours" },
                  { id: "year", label: "Année" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id)}
                    className={`flex-1 rounded-full py-2 text-[11px] font-semibold transition-colors ${
                      period === p.id ? "bg-[#D49B28] text-[#051C23]" : "text-[#8DA4AF]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="mb-6 rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 p-5 backdrop-blur-xl">
                <div className="flex h-[130px] items-end justify-between gap-2">
                  {CHART_DATA[period].map((d, i) => {
                    const max = Math.max(...CHART_DATA[period].map((x) => x.value));
                    const isMax = d.value === max;
                    return (
                      <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${isMax ? "bg-gradient-to-t from-[#C58B1E] to-[#D49B28]" : "bg-white/10"}`}
                          style={{ height: `${(d.value / max) * 100}%`, minHeight: 4 }}
                        />
                        <span className={`text-[10px] ${isMax ? "font-bold text-[#D49B28]" : "text-[#8DA4AF]"}`}>{d.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <h3 className="mb-3.5 text-sm font-bold text-white">Répartition par catégorie</h3>
              <div className="mb-6 flex flex-col gap-4">
                {CATEGORY_BREAKDOWN.map((cat) => (
                  <div key={cat.name}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[12.5px] text-white">
                        {cat.emoji} {cat.name}
                      </span>
                      <span className="tabular-nums font-mono text-[11px] text-[#8DA4AF]">
                        {cat.pct}% · {formatAmount(cat.amount * PERIOD_SCALE[period], "EUR")}
                      </span>
                    </div>
                    <Bar percent={cat.pct} barClass={cat.barClass} height="h-1.5" />
                  </div>
                ))}
              </div>

              <div className="flex gap-3 rounded-2xl border border-[#D49B28]/30 bg-gradient-to-br from-[#D49B28]/15 to-transparent p-4">
                <Sparkles size={18} className="mt-0.5 flex-shrink-0 text-[#D49B28]" />
                <div>
                  <p className="mb-1 text-[11.5px] font-bold text-[#D49B28]">Oria Insights IA</p>
                  <p className="text-[12.5px] leading-relaxed text-white">
                    Vous avez réduit vos dépenses de transport de 14 % par rapport au mois dernier. Excellent rythme !
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ===================== VAULTS ===================== */}
          {activeTab === "vaults" && (
            <div className="px-5 pt-6">
              <h2 className="mb-5 text-xl font-bold text-white">Coffres & Multi-devises</h2>

              <h3 className="mb-3 text-[13px] font-bold text-white">Soldes multi-devises</h3>
              <div className="mb-6 flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 p-4 backdrop-blur-xl">
                  <div>
                    <p className="text-[11px] text-[#8DA4AF]">EUR · Principal</p>
                    <p className="tabular-nums font-mono text-lg font-bold text-white">{formatAmount(balances.EUR, "EUR")}</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D49B28]/15">
                    <span className="text-sm font-bold text-[#D49B28]">€</span>
                  </div>
                </div>

                {["USD", "GBP"].map((cur) => (
                  <div key={cur} className="rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 p-4 backdrop-blur-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-[10.5px] text-[#8DA4AF]">
                          {cur} · Taux en direct : 1 EUR = {RATES[cur]} {cur}
                        </p>
                        <p className="tabular-nums font-mono text-lg font-bold text-white">{formatAmount(balances[cur], cur)}</p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5">
                        <span className="text-sm font-bold text-white">{cur === "USD" ? "$" : "£"}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setConverter({ from: "EUR", to: cur, amount: "100" });
                        setModal("converter");
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#D49B28]/12 py-2"
                    >
                      <ArrowLeftRight size={13} className="text-[#D49B28]" />
                      <span className="text-xs font-bold text-[#D49B28]">Swap immédiat</span>
                    </button>
                  </div>
                ))}
              </div>

              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-bold text-white">Coffres d'épargne</h3>
                <button onClick={() => setModal("newvault")} className="flex items-center gap-1">
                  <Plus size={13} className="text-[#D49B28]" />
                  <span className="text-xs font-semibold text-[#D49B28]">Nouveau coffre</span>
                </button>
              </div>
              <div className="mb-6 flex flex-col gap-3">
                {vaults.map((v) => {
                  const Icon = v.icon;
                  const pct = v.type === "goal" ? (v.current / v.target) * 100 : 100;
                  return (
                    <div key={v.id} className="rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 p-4 backdrop-blur-xl">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D49B28] to-[#C58B1E]">
                          <Icon size={16} className="text-[#051C23]" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[13.5px] font-bold text-white">{v.name}</p>
                          {v.type === "goal" ? (
                            <p className="tabular-nums font-mono text-[11px] text-[#8DA4AF]">
                              {formatAmount(v.current, "EUR")} sur {formatAmount(v.target, "EUR")}
                            </p>
                          ) : (
                            <p className="text-[11px] text-[#8DA4AF]">Rémunéré à {v.rate}% brut annuel</p>
                          )}
                        </div>
                        {v.type !== "goal" && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-400">+{v.rate}%</span>
                        )}
                      </div>
                      {v.type === "goal" ? (
                        <Bar percent={pct} />
                      ) : (
                        <p className="text-[11px] text-[#8DA4AF]">
                          Gain estimé sur 12 mois :{" "}
                          <span className="tabular-nums font-mono font-bold text-emerald-400">{formatAmount((v.current * v.rate) / 100, "EUR")}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#163845]/50 bg-[#0B1E26]/70 p-4 backdrop-blur-xl">
                <div className="flex-1 pr-3.5">
                  <p className="mb-1 text-[13px] font-bold text-white">Arrondi automatique</p>
                  <p className="text-[11px] leading-relaxed text-[#8DA4AF]">
                    Chaque paiement est arrondi à l'euro supérieur, la différence est versée dans votre coffre principal.
                    {roundUp && <span className="mt-1 block font-semibold text-[#D49B28]">Déjà versé ce mois-ci : 14,60 €</span>}
                  </p>
                </div>
                <ToggleSwitch checked={roundUp} onChange={setRoundUp} />
              </div>

              <div className="flex items-start gap-2 pb-4">
                <ShieldCheck size={13} className="mt-0.5 flex-shrink-0 text-[#8DA4AF]" />
                <p className="text-[10.5px] leading-relaxed text-[#8DA4AF]">
                  Fonds garantis à hauteur de 100 000 € par le fonds de garantie des dépôts.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div
          className="sticky bottom-0 z-40 flex items-stretch justify-between border-t border-[#163845]/40 bg-[#081418]/90 px-2 backdrop-blur-lg"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-transform active:scale-90"
              >
                <Icon size={20} strokeWidth={2} className={active ? "text-[#D49B28]" : "text-[#8DA4AF]"} />
                <span className={`text-[9.5px] font-semibold ${active ? "text-white" : "text-[#8DA4AF]"}`}>{item.label}</span>
                <span className={`h-1 w-1 rounded-full bg-[#D49B28] transition-opacity ${active ? "opacity-100" : "opacity-0"}`} />
              </button>
            );
          })}
        </div>

        {/* ===================== MODALS ===================== */}
        {modal === "deposit" && (
          <Modal title="Déposer des fonds" onClose={closeModal}>
            <div className="mb-4 flex gap-3">
              {[
                { id: "applepay", label: "Apple Pay" },
                { id: "card", label: "Carte bancaire" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setDeposit((s) => ({ ...s, method: m.id }))}
                  className={`flex-1 rounded-xl border py-3 text-[12.5px] font-semibold transition-colors ${
                    deposit.method === m.id ? "border-[#D49B28] bg-[#D49B28]/15 text-[#D49B28]" : "border-[#163845]/60 text-[#8DA4AF]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <FieldLabel>Montant</FieldLabel>
            <input
              value={deposit.amount}
              onChange={(e) => setDeposit((s) => ({ ...s, amount: e.target.value.replace(/[^0-9.,]/g, "") }))}
              placeholder="0,00"
              inputMode="decimal"
              className="tabular-nums font-mono mb-4 w-full rounded-xl border border-[#163845]/60 bg-[#081418] px-3.5 py-3 text-xl font-bold text-white outline-none focus:border-[#D49B28]/50"
            />
            <GoldButton onClick={handleDeposit}>Déposer {deposit.amount || "0,00"} €</GoldButton>
          </Modal>
        )}

        {modal === "iban" && (
          <Modal title="Détails du compte" onClose={closeModal}>
            <FieldLabel>IBAN</FieldLabel>
            <div className="mb-3 flex items-center justify-between rounded-xl border border-[#163845]/60 bg-[#081418] p-4">
              <span className="tabular-nums font-mono text-[13.5px] font-semibold text-white">
                {ibanRevealed ? "FR76 3000 4000 2800 0107 8523 964" : "FR76 •••• •••• •••• •••• 964"}
              </span>
              <button onClick={() => setIbanRevealed((v) => !v)}>
                {ibanRevealed ? <EyeOff size={15} className="text-[#8DA4AF]" /> : <Eye size={15} className="text-[#8DA4AF]" />}
              </button>
            </div>
            <FieldLabel>BIC</FieldLabel>
            <div className="mb-5 rounded-xl border border-[#163845]/60 bg-[#081418] p-4">
              <span className="tabular-nums font-mono text-[13.5px] font-semibold text-white">ORIACD2X</span>
            </div>
            <button
              onClick={() => {
                copyIbanQuick();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#D49B28] bg-[#D49B28]/12 py-3.5"
            >
              <Copy size={14} className="text-[#D49B28]" />
              <span className="text-[13px] font-bold text-[#D49B28]">Copier l'IBAN</span>
            </button>
          </Modal>
        )}

        {modal === "txdetail" && modalPayload && (
          <Modal title="Détail de la transaction" onClose={closeModal}>
            <div className="mb-5 flex flex-col items-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
                {(() => {
                  const Icon = modalPayload.icon;
                  return <Icon size={20} className="text-white" />;
                })()}
              </div>
              <p className="text-center text-[15px] font-bold text-white">{modalPayload.name}</p>
              <p className={`tabular-nums font-mono mt-1 text-2xl font-bold ${modalPayload.amount > 0 ? "text-emerald-400" : "text-white"}`}>
                {formatSigned(modalPayload.amount, "EUR")}
              </p>
              <div className="mt-2">
                <StatusBadge status={modalPayload.status} />
              </div>
            </div>
            <div className="mb-5 rounded-2xl border border-[#163845]/60 bg-[#081418] p-4">
              {[
                { label: "Catégorie", value: modalPayload.category },
                { label: "Référence", value: modalPayload.reference },
                { label: "Date", value: modalPayload.date },
                { label: "Heure", value: modalPayload.time },
              ].map((row, i) => (
                <div key={row.label} className={`flex items-center justify-between py-2.5 ${i < 3 ? "border-b border-[#163845]/50" : ""}`}>
                  <span className="text-[12.5px] text-[#8DA4AF]">{row.label}</span>
                  <span className="tabular-nums font-mono text-[12.5px] font-semibold text-white">{row.value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => shareReceipt(modalPayload)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#D49B28] bg-[#D49B28]/12 py-3.5"
            >
              <Share2 size={14} className="text-[#D49B28]" />
              <span className="text-[13px] font-bold text-[#D49B28]">Partager le reçu</span>
            </button>
          </Modal>
        )}

        {modal === "newvault" && (
          <Modal title="Créer un coffre" onClose={closeModal}>
            <FieldLabel>Nom du coffre</FieldLabel>
            <div className="mb-4">
              <TextInput
                value={newVaultForm.name}
                onChange={(e) => setNewVaultForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Ex : Mariage, Appartement…"
              />
            </div>
            <FieldLabel>Objectif</FieldLabel>
            <div className="mb-5">
              <TextInput
                value={newVaultForm.target}
                onChange={(e) => setNewVaultForm((s) => ({ ...s, target: e.target.value.replace(/[^0-9.,]/g, "") }))}
                placeholder="0,00 €"
                inputMode="decimal"
              />
            </div>
            <GoldButton onClick={handleCreateVault}>Créer le coffre</GoldButton>
          </Modal>
        )}

        {modal === "converter" && (
          <Modal title="Convertisseur" onClose={closeModal}>
            <div className="mb-3 rounded-2xl border border-[#163845]/60 bg-[#081418] p-4">
              <FieldLabel>Montant ({converter.from})</FieldLabel>
              <input
                value={converter.amount}
                onChange={(e) => setConverter((s) => ({ ...s, amount: e.target.value.replace(/[^0-9.,]/g, "") }))}
                className="tabular-nums font-mono w-full bg-transparent text-2xl font-bold text-white outline-none"
              />
            </div>
            <div className="mb-3 flex items-center justify-center">
              <button
                onClick={() => setConverter((s) => ({ ...s, from: s.to, to: s.from }))}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D49B28]/15 transition-transform active:scale-90"
              >
                <ArrowLeftRight size={14} className="text-[#D49B28]" />
              </button>
            </div>
            <div className="mb-5 rounded-2xl border border-[#163845]/60 bg-[#081418] p-4">
              <FieldLabel>Vous recevez ({converter.to})</FieldLabel>
              <p className="tabular-nums font-mono text-2xl font-bold text-[#D49B28]">{convertedAmount}</p>
            </div>
            <GoldButton onClick={handleConvert}>Convertir maintenant</GoldButton>
            {converterError && <p className="mt-2.5 text-center text-xs text-[#EF4444]">{converterError}</p>}
          </Modal>
        )}

        {modal === "addcontact" && (
          <Modal title="Nouveau destinataire" onClose={closeModal}>
            <FieldLabel>Nom complet</FieldLabel>
            <div className="mb-5">
              <TextInput value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder="Ex : Manon Guillet" />
            </div>
            <GoldButton onClick={handleAddContact}>Ajouter</GoldButton>
          </Modal>
        )}
      </div>
    </div>
  );
}
