import React, { createContext, useContext } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export type Language = "uz" | "ru" | "en";

const translations = {
  // Settings
  settings: { uz: "Sozlamalar", ru: "Настройки", en: "Settings" },
  account: { uz: "Akkount", ru: "Аккаунт", en: "Account" },
  email: { uz: "Email", ru: "Эл. почта", en: "Email" },
  appearance: { uz: "Ko'rinish", ru: "Оформление", en: "Appearance" },
  darkMode: { uz: "Qorong'u rejim", ru: "Тёмная тема", en: "Dark mode" },
  security: { uz: "Xavfsizlik", ru: "Безопасность", en: "Security" },
  securityDesc: {
    uz: "Akkount email orqali himoyalangan",
    ru: "Аккаунт защищён по эл. почте",
    en: "Account protected via email",
  },
  logout: { uz: "Chiqish", ru: "Выйти", en: "Log out" },
  loggedOut: { uz: "Chiqildi", ru: "Вы вышли", en: "Logged out" },
  loggedOutDesc: { uz: "Muvaffaqiyatli chiqdingiz", ru: "Вы успешно вышли", en: "Successfully logged out" },
  language: { uz: "Til", ru: "Язык", en: "Language" },
  privacy: { uz: "Maxfiylik", ru: "Конфиденциальность", en: "Privacy" },
  privateAccount: { uz: "Yopiq akkaunt", ru: "Закрытый аккаунт", en: "Private account" },
  privateAccountDesc: {
    uz: "Faqat kuzatuvchilar postlaringizni ko'rsin",
    ru: "Только подписчики могут видеть ваши посты",
    en: "Only followers can see your posts",
  },
  hideOnline: { uz: "Onlaynlikni yashirish", ru: "Скрыть онлайн-статус", en: "Hide online status" },
  hideOnlineDesc: {
    uz: "Boshqalar online holatni ko'rmasin",
    ru: "Другие не увидят ваш онлайн-статус",
    en: "Others won't see your online status",
  },
  hideHighlights: { uz: "Hikoya lentani yashirish", ru: "Скрыть хайлайты", en: "Hide highlights" },
  hideHighlightsDesc: {
    uz: "Profildan highlights ko'rinmasin",
    ru: "Хайлайты не будут видны в профиле",
    en: "Highlights won't be visible in profile",
  },
  hideCollections: { uz: "Post ro'yxatlarni yashirish", ru: "Скрыть подборки", en: "Hide collections" },
  hideCollectionsDesc: {
    uz: "Collections boshqalarga ko'rinmasin",
    ru: "Подборки не будут видны другим",
    en: "Collections won't be visible to others",
  },
  hideMentions: { uz: "Belgilangan postlarni yashirish", ru: "Скрыть упоминания", en: "Hide mentions" },
  hideMentionsDesc: {
    uz: "Profildan mentions ko'rinmasin",
    ru: "Упоминания не будут видны в профиле",
    en: "Mentions won't be visible in profile",
  },
  hideSaved: { uz: "Saqlangan postlarni yashirish", ru: "Скрыть сохранённые", en: "Hide saved posts" },
  hideSavedDesc: {
    uz: "Profildan saqlanganlar ko'rinmasin",
    ru: "Сохранённые посты не будут видны в профиле",
    en: "Saved posts won't be visible in profile",
  },

  // Auth
  welcome: { uz: "Xush kelibsiz!", ru: "Добро пожаловать!", en: "Welcome!" },
  login: { uz: "KIRISH", ru: "ВОЙТИ", en: "LOG IN" },
  loggingIn: { uz: "Kirilmoqda...", ru: "Вход...", en: "Logging in..." },
  or: { uz: "yoki", ru: "или", en: "or" },
  noAccount: { uz: "Akkauntingiz yo'qmi?", ru: "Нет аккаунта?", en: "No account?" },
  register: { uz: "Ro'yxatdan o'ting", ru: "Регистрация", en: "Sign up" },
  haveAccount: { uz: "Akkauntingiz bormi?", ru: "Есть аккаунт?", en: "Have account?" },
  signIn: { uz: "Kirish", ru: "Войти", en: "Sign in" },
  hello: { uz: "Salom!", ru: "Привет!", en: "Hello!" },
  createAccount: { uz: "Yangi akkaunt yarating", ru: "Создайте аккаунт", en: "Create an account" },
  username: { uz: "Ism va Familiya", ru: "Имя и Фамилия", en: "Full Name" },
  userHandle: { uz: "Foydalanuvchi nomi", ru: "Имя пользователя", en: "Username" },
  password: { uz: "Parol", ru: "Пароль", en: "Password" },
  signup: { uz: "RO'YXATDAN O'TISH", ru: "РЕГИСТРАЦИЯ", en: "SIGN UP" },
  signingUp: { uz: "Ro'yxatdan o'tilmoqda...", ru: "Регистрация...", en: "Signing up..." },
  genderOptional: { uz: "Jins (ixtiyoriy)", ru: "Пол (необяз.)", en: "Gender (optional)" },
  male: { uz: "Erkak", ru: "Муж.", en: "Male" },
  female: { uz: "Ayol", ru: "Жен.", en: "Female" },
  socialSignup: { uz: "Ijtimoiy tarmoq orqali", ru: "Через соц. сеть", en: "Via social network" },
  comingSoon: {
    uz: "google va telifon tez orada ishlaydi",
    ru: "Google и телефон скоро заработают",
    en: "Google & phone coming soon",
  },
  error: { uz: "Xato", ru: "Ошибка", en: "Error" },
  fillAllFields: { uz: "Barcha maydonlarni to'ldiring", ru: "Заполните все поля", en: "Fill all fields" },
  enterEmailPass: { uz: "Email va parolni kiriting", ru: "Введите email и пароль", en: "Enter email and password" },
  passMinLength: {
    uz: "Parol kamida 6 ta belgidan iborat bo'lishi kerak",
    ru: "Минимум 6 символов",
    en: "Min 6 characters",
  },
  success: { uz: "Muvaffaqiyatli!", ru: "Успешно!", en: "Success!" },
  loggedInMsg: { uz: "Tizimga kirdingiz", ru: "Вы вошли", en: "Logged in" },
  registeredMsg: { uz: "Ro'yxatdan o'tdingiz", ru: "Вы зарегистрировались", en: "Registered" },
  settingsUpdated: { uz: "Sozlamalar yangilandi", ru: "Настройки обновлены", en: "Settings updated" },
  settingsUpdateError: {
    uz: "Sozlamalarni yangilashda xatolik yuz berdi",
    ru: "Ошибка при обновлении настроек",
    en: "Error updating settings",
  },
  loginError: { uz: "Tizimga kirishda xato", ru: "Ошибка входа", en: "Login error" },
  signupError: { uz: "Ro'yxatdan o'tishda xato", ru: "Ошибка регистрации", en: "Signup error" },
  googleError: { uz: "Google bilan kirishda xato", ru: "Ошибка входа через Google", en: "Google login error" },

  // Bottom nav
  home: { uz: "Bugun", ru: "Главная", en: "Home" },
  relativesNav: { uz: "Qarindosh", ru: "Родные", en: "Family" },
  addNav: { uz: "Yaratish", ru: "Создать", en: "Create" },
  messagesNav: { uz: "Xabarlar", ru: "Чаты", en: "Messages" },
  profileNav: { uz: "Profil", ru: "Профиль", en: "Profile" },

  // Messages page
  messages: { uz: "Xabarlar", ru: "Сообщения", en: "Messages" },
  searchChats: { uz: "Qidirish...", ru: "Поиск...", en: "Search..." },
  allChats: { uz: "Barcha", ru: "Все", en: "All" },
  groups: { uz: "Guruhlar", ru: "Группы", en: "Groups" },
  channels: { uz: "Kanallar", ru: "Каналы", en: "Channels" },
  followersTab: { uz: "Kuzatuvchilar", ru: "Подписчики", en: "Followers" },
  followingTab: { uz: "Kuzatilmoqda", ru: "Подписки", en: "Following" },
  noChats: { uz: "Hozircha chatlar yo'q", ru: "Пока нет чатов", en: "No chats yet" },
  createGroupOrChannel: {
    uz: "Guruh yoki kanal yarating",
    ru: "Создайте группу или канал",
    en: "Create a group or channel",
  },
  noGroups: { uz: "Guruhlar yo'q", ru: "Нет групп", en: "No groups" },
  createNewGroup: { uz: "Yangi guruh yaratish", ru: "Создать группу", en: "Create group" },
  noChannels: { uz: "Kanallar yo'q", ru: "Нет каналов", en: "No channels" },
  createNewChannel: { uz: "Yangi kanal yaratish", ru: "Создать канал", en: "Create channel" },
  noFollowers: { uz: "Kuzatuvchilar yo'q", ru: "Нет подписчиков", en: "No followers" },
  notFollowing: { uz: "Hech kimni kuzatmayapsiz", ru: "Вы ни на кого не подписаны", en: "Not following anyone" },
  messageBtn: { uz: "Xabar", ru: "Написать", en: "Message" },
  loading: { uz: "Yuklanmoqda...", ru: "Загрузка...", en: "Loading..." },
  groupCreated: { uz: "Guruh yaratildi!", ru: "Группа создана!", en: "Group created!" },
  channelCreated: { uz: "Kanal yaratildi!", ru: "Канал создан!", en: "Channel created!" },
  errorOccurred: { uz: "Xatolik yuz berdi", ru: "Произошла ошибка", en: "An error occurred" },
  you: { uz: "Siz", ru: "Вы", en: "You" },
  user: { uz: "Foydalanuvchi", ru: "Пользователь", en: "User" },

  // Chat
  typing: { uz: "yozyapti...", ru: "печатает...", en: "typing..." },
  lastActivity: { uz: "oxirgi faollik", ru: "был(а) в сети", en: "last seen" },
  startChat: { uz: "Suhbatni boshlang!", ru: "Начните чат!", en: "Start chatting!" },
  writeMessage: { uz: "Xabar yozing...", ru: "Напишите...", en: "Type a message..." },
  msgDeleted: { uz: "Xabar o'chirildi", ru: "Сообщение удалено", en: "Message deleted" },
  msgDeletedAll: { uz: "Xabar barcha uchun o'chirildi", ru: "Удалено для всех", en: "Deleted for everyone" },
  today: { uz: "Bugun", ru: "Сегодня", en: "Today" },
  yesterday: { uz: "Kecha", ru: "Вчера", en: "Yesterday" },

  // Profile
  posts: { uz: "Postlar", ru: "Посты", en: "Posts" },
  followers: { uz: "Kuzatuvchilar", ru: "Подписчики", en: "Followers" },
  following: { uz: "Kuzatilmoqda", ru: "Подписки", en: "Following" },
  editProfile: { uz: "Profilni tahrirlash", ru: "Редактировать", en: "Edit profile" },
  noPosts: { uz: "Hozircha postlar yo'q", ru: "Пока нет постов", en: "No posts yet" },
  createFirst: { uz: "Birinchi postingizni yarating!", ru: "Создайте первый пост!", en: "Create your first post!" },
  noSaved: { uz: "Saqlangan postlar yo'q", ru: "Нет сохранённых", en: "No saved posts" },
  savedHint: {
    uz: "Postlarni saqlash uchun bookmark tugmasini bosing",
    ru: "Нажмите закладку для сохранения",
    en: "Tap bookmark to save posts",
  },
  profileInfo: { uz: "Profil ma'lumotlari", ru: "Данные профиля", en: "Profile info" },
  fullName: { uz: "To'liq ism", ru: "Полное имя", en: "Full name" },
  yourName: { uz: "Ismingiz", ru: "Ваше имя", en: "Your name" },
  bio: { uz: "Bio", ru: "О себе", en: "Bio" },
  bioPlaceholder: { uz: "O'zingiz haqingizda qisqacha...", ru: "Коротко о себе...", en: "Tell about yourself..." },
  bioLimit: { uz: "belgidan oshmasligi kerak", ru: "символов максимум", en: "characters max" },
  gender: { uz: "Jins", ru: "Пол", en: "Gender" },
  saved: { uz: "Saqlandi!", ru: "Сохранено!", en: "Saved!" },
  profileUpdated: { uz: "Profil yangilandi", ru: "Профиль обновлён", en: "Profile updated" },
  saving: { uz: "Saqlanmoqda...", ru: "Сохранение...", en: "Saving..." },
  save: { uz: "Saqlash", ru: "Сохранить", en: "Save" },
  changeCover: { uz: "Muqova rasmini o'zgartirish", ru: "Изменить обложку", en: "Change cover" },
  changeAvatar: { uz: "Avatar rasmini o'zgartirish", ru: "Изменить аватар", en: "Change avatar" },
  cropAvatar: { uz: "Profil rasmini kesish", ru: "Обрезать фото", en: "Crop photo" },
  cropCover: { uz: "Muqova rasmini kesish", ru: "Обрезать обложку", en: "Crop cover" },
  uploadError: { uz: "Rasm yuklanmadi", ru: "Ошибка загрузки", en: "Upload failed" },
  updateError: { uz: "Profilni yangilashda xato", ru: "Ошибка обновления", en: "Update error" },

  // Home
  feed: { uz: "Qarindosh", ru: "Лента", en: "Feed" },
  noPostsYet: { uz: "Hozircha postlar yo'q", ru: "Пока нет постов", en: "No posts yet" },
  createFirstPost: { uz: "Birinchi postni yarating!", ru: "Создайте первый пост!", en: "Create the first post!" },

  // Notifications
  notifications: { uz: "Bildirishnomalar", ru: "Уведомления", en: "Notifications" },
  familyInvites: {
    uz: "Oila daraxti taklifnomalari",
    ru: "Приглашения в семейное дерево",
    en: "Family tree invitations",
  },

  // AI
  aiName: { uz: "AI Do'stim", ru: "AI Друг", en: "AI Friend" },
  aiDesc: { uz: "Har qanday savolga javob beraman!", ru: "Отвечу на любой вопрос!", en: "I answer any question!" },

  // Group chat items
  noMessagesYet: { uz: "Hozircha xabarlar yo'q", ru: "Пока нет сообщений", en: "No messages yet" },
  members: { uz: "a'zo", ru: "участн.", en: "members" },

  // General
  cancel: { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" },
  delete: { uz: "O'chirish", ru: "Удалить", en: "Delete" },
  send: { uz: "Yuborish", ru: "Отправить", en: "Send" },
  back: { uz: "Orqaga", ru: "Назад", en: "Back" },
  next: { uz: "Keyingisi", ru: "Далее", en: "Next" },
  newGroup: { uz: "Yangi guruh", ru: "Новая группа", en: "New group" },
  newChannel: { uz: "Yangi kanal", ru: "Новый канал", en: "New channel" },
  channelName: { uz: "Kanal nomi", ru: "Название канала", en: "Channel name" },
  namePlaceholder: { uz: "Nomini kiriting", ru: "Введите название", en: "Enter name" },
} as const;

type TranslationKey = keyof typeof translations;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useLocalStorage<Language>("app-language", "uz");

  const t = (key: TranslationKey): string => {
    return translations[key]?.[lang] || translations[key]?.["uz"] || key;
  };

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
