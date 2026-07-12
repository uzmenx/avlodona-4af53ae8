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
    uz: "To'plamlarni yashirish",
    ru: "Подборки не будут видны другим",
    en: "Collections won't be visible to others",
  },
  hideMentions: { uz: "Belgilangan postlarni yashirish", ru: "Скрыть упоминания", en: "Hide mentions" },
  hideMentionsDesc: {
    uz: "Eslatmalarni yashirish",
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
  landingH1: {
    uz: "Avlodona",
    ru: "Avlodona",
    en: "Avlodona",
  },
  landingTagline: {
    uz: "Dunyo bir oila va Raqamli xotira",
    ru: "Единая семья, цифровая память",
    en: "One family, digital memory",
  },
  createAccount: { uz: "Yangi akkaunt yarating", ru: "Создайте аккаунт", en: "Create an account" },
  username: { uz: "Ism va Familiya", ru: "Имя и Фамилия", en: "Full Name" },
  nameOptional: { uz: "Ismingiz (ixtiyoriy)", ru: "Ваше имя (необязательно)", en: "Your name (optional)" },
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
  me: { uz: "Men", ru: "Я", en: "Me" },
  home: { uz: "Bugun", ru: "Главная", en: "Home" },
  relativesNav: { uz: "Qarindosh", ru: "Родные", en: "Family" },
  addNav: { uz: "Yaratish", ru: "Создать", en: "Create" },
  messagesNav: { uz: "Xabarlar", ru: "Чаты", en: "Messages" },
  profileNav: { uz: "Profil", ru: "Профиль", en: "Profile" },

  // Messages page
  messages: { uz: "Xabarlar", ru: "Сообщения", en: "Messages" },
  searchChats: { uz: "Qidirish...", ru: "Поиск...", en: "Search..." },
  allChats: { uz: "Barcha", ru: "Все", en: "All" },
  groups: { uz: "Guruh", ru: "Группы", en: "Groups" },
  channels: { uz: "Kanal", ru: "Каналы", en: "Channels" },
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

  // Profile & UserProfile page specific
  familyMembers: { uz: "Oila a'zolari", ru: "Члены семьи", en: "Family members" },
  year: { uz: "Yili", ru: "Год", en: "Year" },
  relative: { uz: "Qarindosh", ru: "Родственник", en: "Relative" },
  postsEnded: { uz: "Postlar tugadi", ru: "Посты закончились", en: "No more posts" },
  noPostsInList: { uz: "Bu ro'yxatda postlar yo'q", ru: "В списке нет постов", en: "No posts in this list" },
  noMentions: { uz: "Siz belgilangan postlar yo'q", ru: "Нет упомянутых постов", en: "No mentioned posts" },
  noMentionedPosts: { uz: "Belgilangan postlar yo'q", ru: "Нет упоминаний", en: "No mentions" },
  userNotFound: { uz: "Foydalanuvchi topilmadi", ru: "Пользователь не найден", en: "User not found" },
  privateAccount: { uz: "Bu akkaunt yopiq", ru: "Этот аккаунт закрыт", en: "This account is private" },
  privateAccountFollow: {
    uz: "Post va rasmlarni ko'rish uchun ushbu foydalanuvchiga obuna bo'ling.",
    ru: "Подпишитесь, чтобы видеть посты и фото.",
    en: "Follow this user to see their posts and photos.",
  },
  blockedByYou: { uz: "Siz bu foydalanuvchini bloklagansiz.", ru: "Вы заблокировали этого пользователя.", en: "You have blocked this user." },
  blockedByThem: { uz: "Siz bu foydalanuvchi tomonidan bloklangansiz.", ru: "Вас заблокировал этот пользователь.", en: "You are blocked by this user." },
  contactRestricted: { uz: "Bu foydalanuvchi bilan aloqa cheklangan.", ru: "Общение с этим пользователем ограничено.", en: "Contact with this user is restricted." },
  profileLink: { uz: "Profil linki", ru: "Ссылка на профиль", en: "Profile link" },
  linkCopied: { uz: "Havola nusxalandi", ru: "Ссылка скопирована", en: "Link copied" },
  copyError: { uz: "Nusxalashda xatolik", ru: "Ошибка копирования", en: "Copy error" },
  blockUser: { uz: "Bloklash", ru: "Заблокировать", en: "Block" },
  unblockUser: { uz: "Blokdan chiqarish", ru: "Разблокировать", en: "Unblock" },
  userBlocked: { uz: "Foydalanuvchi bloklandi", ru: "Пользователь заблокирован", en: "User blocked" },
  userUnblocked: { uz: "Blok olib tashlandi", ru: "Пользователь разблокирован", en: "User unblocked" },
  storyNotFound: { uz: "Hikoya topilmadi", ru: "История не найдена", en: "Story not found" },
  profileSaved: { uz: "Profil muvaffaqiyatli saqlandi", ru: "Профиль успешно сохранён", en: "Profile saved successfully" },
  errorOccurredShort: { uz: "Xatolik yuz berdi", ru: "Произошла ошибка", en: "An error occurred" },
  savedPostsHidden: { uz: "Saqlangan postlar yopiq", ru: "Сохранённые посты скрыты", en: "Saved posts are hidden" },
  mentionsHidden: { uz: "Eslatmalar yopiq", ru: "Упоминания скрыты", en: "Mentions are hidden" },
  noMemorialPosts: { uz: "Hali xotira post yo'q", ru: "Нет постов памяти", en: "No memorial posts yet" },
  tapPlusToAdd: { uz: "+ tugmasini bosing", ru: "Нажмите +", en: "Tap + to add" },
  addMemorial: { uz: "Xotira qo'shish", ru: "Добавить память", en: "Add memorial" },
  noSavedPosts: { uz: "Hozircha saqlangan postlar yo'q", ru: "Пока нет сохранённых постов", en: "No saved posts yet" },
  // Collection editor
  newList: { uz: "Yangi ro'yxat", ru: "Новый список", en: "New list" },
  editList: { uz: "Ro'yxatni tahrirlash", ru: "Редактировать список", en: "Edit list" },
  giveListName: { uz: "Nom bering", ru: "Назовите", en: "Give a name" },
  listNamePlaceholder: { uz: "Masalan: Sevimli postlar", ru: "Например: Избранные", en: "E.g.: Favorites" },
  chooseTheme: { uz: "Mavzu tanlang", ru: "Выберите тему", en: "Choose theme" },
  allPosts: { uz: "Barcha postlar", ru: "Все посты", en: "All posts" },
  selected: { uz: "Tanlanganlar", ru: "Выбранные", en: "Selected" },
  createList: { uz: "Ro'yxatni yaratish", ru: "Создать список", en: "Create list" },
  // Memorial edit modal
  nameLabel: { uz: "Ism", ru: "Имя", en: "Name" },
  yearsLabel: { uz: "Yillar", ru: "Годы", en: "Years" },
  bornYear: { uz: "Tug'ilgan", ru: "Рождение", en: "Born" },
  deathYear: { uz: "Vafot etgan", ru: "Смерть", en: "Died" },
  changeCoverPhoto: { uz: "Fon rasmini o'zgartirish", ru: "Изменить фон", en: "Change cover photo" },
  enterName: { uz: "Ismini kiriting", ru: "Введите имя", en: "Enter name" },
  addMemorialPost: { uz: "Xotira post qoldirish", ru: "Добавить пост памяти", en: "Add memory post" },
  edit: { uz: "Tahrirlash", ru: "Редактировать", en: "Edit" },

  // Follow & Message buttons
  followBtn: { uz: "Kuzatish", ru: "Подписаться", en: "Follow" },
  followingBtn: { uz: "Kuzatasiz", ru: "Подписаны", en: "Following" },
  requestedBtn: { uz: "So'rov yuborildi", ru: "Запрос отправлен", en: "Requested" },
  messageBtn2: { uz: "Xabar", ru: "Написать", en: "Message" },

  // Tree Ratings
  treeRating: { uz: "Daraxt reytingi", ru: "Рейтинг дерева", en: "Tree rating" },
  likesTab: { uz: "Layklar", ru: "Лайки", en: "Likes" },
  profilesCount: { uz: "Profillar soni", ru: "Кол-во профилей", en: "Profile count" },
  noDataYet: { uz: "Hali ma'lumot yo'q", ru: "Данных пока нет", en: "No data yet" },

  // Family Calendar
  familyCalendar: { uz: "Oilaviy Kalendar", ru: "Семейный календарь", en: "Family Calendar" },
  today: { uz: "Bugun", ru: "Сегодня", en: "Today" },
  next30days: { uz: "Yaqin 30 kun", ru: "Ближайшие 30 дней", en: "Next 30 days" },
  allEvents: { uz: "Barcha voqealar", ru: "Все события", en: "All events" },
  addEvent: { uz: "Qo'shish", ru: "Добавить", en: "Add" },
  noEventsYet: { uz: "Hali voqealar qo'shilmagan", ru: "Событий пока нет", en: "No events added yet" },
  eventTitle: { uz: "Sarlavha", ru: "Название", en: "Title" },
  eventNote: { uz: "Izoh (ixtiyoriy)", ru: "Комментарий (необязательно)", en: "Note (optional)" },
  repeatYearly: { uz: "Har yil takrorlansin", ru: "Повторять ежегодно", en: "Repeat yearly" },
  everyYear: { uz: "Har yil", ru: "Каждый год", en: "Every year" },

  // Tree Stats Drawer (Barcha profillar / Faol foydalanuvchilar)
  allProfiles: { uz: "Barcha profillar", ru: "Все профили", en: "All profiles" },
  activeUsers: { uz: "Faol foydalanuvchilar", ru: "Активные пользователи", en: "Active users" },
  liveTab: { uz: "Jonli", ru: "Живые", en: "Live" },
  memorialTab: { uz: "Xotira", ru: "Память", en: "Memorial" },
  goToProfile: { uz: "Profilga o'tish →", ru: "Открыть профиль →", en: "Go to profile →" },
  goToMemorial: { uz: "Xotira sahifasiga →", ru: "Страница памяти →", en: "Go to memorial →" },
  noActiveUsers: { uz: "Hech qanday faol foydalanuvchi yo'q", ru: "Нет активных пользователей", en: "No active users" },
  noMemorialProfiles: { uz: "Xotira profillari mavjud emas", ru: "Нет профилей памяти", en: "No memorial profiles" },
  sendMessage: { uz: "Habar yuborish", ru: "Отправить сообщение", en: "Send message" },
  addMemoryPost: { uz: "Xotira post qoldirish", ru: "Добавить пост памяти", en: "Add memory post" },
  deceased: { uz: "Vafot etgan", ru: "Скончался", en: "Deceased" },
  unknown: { uz: "Noma'lum", ru: "Неизвестно", en: "Unknown" },

  // Tree Publish Dialog
  publishTree: { uz: "Daraxtni nashr qilish", ru: "Опубликовать дерево", en: "Publish tree" },
  familyTree: { uz: "Oila daraxti", ru: "Семейное дерево", en: "Family tree" },
  interactivePost: { uz: "Interaktiv daraxt post", ru: "Интерактивный пост", en: "Interactive tree post" },
  writeCaption: { uz: "Izoh yozing...", ru: "Напишите подпись...", en: "Write a caption..." },
  publishing: { uz: "Nashr qilinmoqda...", ru: "Публикуется...", en: "Publishing..." },
  publish: { uz: "Nashr qilish", ru: "Опубликовать", en: "Publish" },

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
  earlier: { uz: "Avvalroq", ru: "Ранее", en: "Earlier" },
  markAllRead: { uz: "Barchasini o'qilgan deb belgilash", ru: "Отметить все как прочитанные", en: "Mark all as read" },
  newNotificationsCount: { uz: "ta yangi", ru: "новых", en: "new" },
  noNotifications: { uz: "Bildirishnomalar yo'q", ru: "Нет уведомлений", en: "No notifications" },
  noNotificationsDesc: { uz: "Yangi bildirishnomalar shu yerda ko'rinadi", ru: "Новые уведомления появятся здесь", en: "New notifications will appear here" },
  notificationsTip: { uz: "💡 Maslahat: o'ng tomonga sursangiz o'qildi, chap tomonga sursangiz o'chiriladi", ru: "💡 Подсказка: свайп вправо — прочитать, влево — удалить", en: "💡 Tip: swipe right to read, swipe left to delete" },
  followBack: { uz: "Javob qaytarish", ru: "Подписаться в ответ", en: "Follow back" },
  accept: { uz: "Qabul", ru: "Принять", en: "Accept" },
  decline: { uz: "Rad", ru: "Отклонить", en: "Decline" },
  accepted: { uz: "Qabul qilindi", ru: "Принято", en: "Accepted" },
  declined: { uz: "Rad etildi", ru: "Отклонено", en: "Declined" },

  // AI
  aiName: { uz: "AI Do'stim", ru: "AI Друг", en: "AI Friend" },
  aiDesc: { uz: "Har qanday savolga javob beraman!", ru: "Отвечу на любой вопрос!", en: "I answer any question!" },

  // Group chat items
  noMessagesYet: { uz: "Hozircha xabarlar yo'q", ru: "Пока нет сообщений", en: "No messages yet" },
  members: { uz: "a'zo", ru: "участн.", en: "members" },

  // General
  search: { uz: "Qidirish", ru: "Поиск", en: "Search" },
  sending: { uz: "Yuborilmoqda...", ru: "Отправка...", en: "Sending..." },
  searchPlaceholder: { uz: "Ism, username yoki guruh qidiring...", ru: "Ищите имя, имя пользователя или группу...", en: "Search name, username or group..." },
  commentsTitle: { uz: "Izohlar", ru: "Комментарии", en: "Comments" },
  noComments: { uz: "Hozircha izohlar yo'q", ru: "Пока нет комментариев", en: "No comments yet" },
  noCommentsDesc: { uz: "Birinchi bo'lib izoh qoldiring!", ru: "Будьте первым, кто оставит комментарий!", en: "Be the first to comment!" },
  writeComment: { uz: "Izoh yozing...", ru: "Написать комментарий...", en: "Write a comment..." },
  reply: { uz: "Javob", ru: "Ответить", en: "Reply" },
  people: { uz: "Odamlar", ru: "Люди", en: "People" },
  groupsTab: { uz: "Guruhlar", ru: "Группы", en: "Groups" },
  startSearch: { uz: "Qidiruvni boshlang", ru: "Начните поиск", en: "Start searching" },
  startSearchDesc: { uz: "Odamlar, postlar, kanallar yoki guruhlarni topish uchun yuqoriga yozing", ru: "Введите текст выше для поиска людей, постов, каналов или групп", en: "Type above to find people, posts, channels or groups" },
  searching: { uz: "Qidirilmoqda...", ru: "Поиск...", en: "Searching..." },
  noResults: { uz: "Hech narsa topilmadi", ru: "Ничего не найдено", en: "No results found" },
  noResultsDesc: { uz: "Kiritilgan so'rov bo'yicha hech qanday natija yo'q", ru: "По вашему запросу ничего не найдено", en: "No results matched your query" },
  noPostsDescMatched: { uz: "Kiritilgan so'rov bo'yicha hech qanday post topilmadi", ru: "По вашему запросу постов не найдено", en: "No posts matched your query" },
  noGroupsDescMatched: { uz: "Kiritilgan so'rov bo'yicha hech qanday guruh yoki kanal topilmadi", ru: "По вашему запросу групп или каналов не найдено", en: "No groups or channels matched your query" },
  cancel: { uz: "Bekor qilish", ru: "Отмена", en: "Cancel" },
  delete: { uz: "O'chirish", ru: "Удалить", en: "Delete" },
  send: { uz: "Yuborish", ru: "Отправить", en: "Send" },
  back: { uz: "Orqaga", ru: "Назад", en: "Back" },
  next: { uz: "Keyingisi", ru: "Далее", en: "Next" },
  newGroup: { uz: "Yangi guruh", ru: "Новая группа", en: "New group" },
  newChannel: { uz: "Yangi kanal", ru: "Новый канал", en: "New channel" },
  channelName: { uz: "Kanal nomi", ru: "Название канала", en: "Channel name" },
  namePlaceholder: { uz: "Nomini kiriting", ru: "Введите название", en: "Enter name" },
  gallery: { uz: "Galereya", ru: "Галерея", en: "Gallery" },
  gifs: { uz: "GIFlar", ru: "GIF", en: "GIFs" },
  searchGifs: { uz: "GIPHY'dan izlash...", ru: "Поиск в GIPHY...", en: "Search GIPHY..." },
  allowPermission: { uz: "Ruxsat berish", ru: "Разрешить", en: "Allow" },
  givePermissionDesc: { uz: "Rasmlarni ko'rish uchun ruxsat bering", ru: "Разрешите доступ к фотографиям", en: "Please grant access to photos" },
  cropHint: { uz: "Moslashtirish uchun suring yoki masshtablang", ru: "Перетащите или масштабируйте для настройки", en: "Drag or pinch to adjust" },
  uploadFromDevice: { uz: "Tizimdan rasm yuklash", ru: "Загрузить с устройства", en: "Upload from device" },
  uploadFromDeviceDesc: { uz: "Istalgan PNG, JPG formatidagi rasmni yuklang", ru: "Загрузите любое изображение PNG, JPG", en: "Upload any PNG, JPG image" },
  selectGif: { uz: "GIF tanlang", ru: "Выберите GIF", en: "Select a GIF" },
  selectPhoto: { uz: "Rasm tanlang", ru: "Выберите фото", en: "Select a photo" },
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
