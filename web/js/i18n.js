// Перевод интерфейса. Модуль не зависит от DOM: словари проверяет node-тест.
// Строка словаря — текст или HTML (для ключей home.*, где есть разметка); {name} — подстановка параметра.
// Формы для plural() — массив [одна, несколько, много] (одинаково для русского и белорусского).

export const LANGS = { ru: "Русский", be: "Беларуская" };
// Короткие подписи для переключателя в шапке
export const LANG_SHORT = { ru: "Рус", be: "Бел" };
export const DEFAULT_LANG = "ru";

const STRINGS = {
  ru: {
    "doc.title": "Spragos — тренажёр литовской грамматики",
    "lang.label": "Язык интерфейса",
    "nav.home": "На главную",
    "nav.setup": "Упражнение",
    "nav.refs": "Справка",
    "nav.stats": "Статистика",

    "home.kicker": "мини-тренажёр литовской грамматики",
    "home.lead": "<em>Spragos</em> по-литовски значит «пропуски»: и в тексте, и в знаниях. Основная механика на данный момент — предложения с пропусками: перетащите в каждый пропуск слово в правильной форме или впишите его с клавиатуры. Сейчас есть упражнения на склонение существительных, прилагательных, местоимений и числительных, более 500 пропусков на каждую тему.",
    "home.start": "Начать упражнение",
    "home.refs": "Грамматическая справка",
    "home.about.title": "Что это",
    "home.about.text": "Небольшой тренажёр, который был сделан мной с помощью Claude для собственной подготовки к экзамену по литовскому языку, когда понадобилось быстро пройтись по определённым темам. Им может пользоваться кто угодно.",
    "home.about.noAccount": "<strong>Без регистрации.</strong> Аккаунт не нужен, никакие данные никуда не отправляются.",
    "home.about.stats": "<strong>Статистика хранится только в вашем браузере.</strong> На другом устройстве или в другом браузере она будет своя; очистка данных сайта её сотрёт.",
    "home.about.mobile": "<strong>Работает на телефоне:</strong> слова можно перетаскивать пальцем или просто нажать на слово, а потом на пропуск.",
    "home.about.modes": "<strong>Два режима:</strong> перетаскивание слов из банка или ввод с клавиатуры. Для литовских букв (ą, č, ę, ė, į, š, ų, ū, ž) есть панель, если их нет на клавиатуре.",
    "home.warn.title": "Важно о материалах",
    "home.warn.ai": "Задания и справки <strong>полностью сгенерированы ИИ</strong> и <strong>не проверялись носителями языка</strong>. Каждая форма в ответах автоматически сверена с таблицами склонения из учебников, но ошибки в выборе падежа или неестественные фразы всё же возможны.",
    "home.warn.books": "Чтобы примеры были как можно правильнее, часть предложений взята из учебников, найденных в свободном доступе в интернете, <strong>дословно или почти дословно</strong>. Права на них принадлежат авторам этих книг, поэтому при копировании и использовании материалов будьте осторожны.",
    "home.warn.sources": "Источники: Žingsnis I–II, Sėkmės, Langas į lietuvių kalbą, Lietuvių kalba dialoguose, Ne dienos be lietuvių kalbos, Skaitome ir klausome lietuviškai, Mano ir tavo šalis Lietuva, Complete Lithuanian, Colloquial Lithuanian.",
    "home.license.title": "Лицензия",
    "home.license.text": "Пользоваться, копировать и переделывать можно как угодно. Всё предоставляется «как есть»: могут быть ошибки как в коде, так и в заданиях.",
    "home.license.code": "<strong>Код</strong> — лицензия <a href=\"https://opensource.org/license/mit\" target=\"_blank\" rel=\"noopener\">MIT</a>.",
    "home.license.content": "<strong>Задания и справки</strong> — <a href=\"https://creativecommons.org/publicdomain/zero/1.0/deed.ru\" target=\"_blank\" rel=\"noopener\">CC0 1.0</a> (общественное достояние), кроме фраз, взятых из учебников: на них права сохраняются за авторами.",
    "home.license.source": "Исходный код и база заданий: <a href=\"https://github.com/jekhor/spragos\" target=\"_blank\" rel=\"noopener\">github.com/jekhor/spragos</a>.",

    "setup.topics": "Темы",
    "setup.selectAll": "выбрать все",
    "setup.selectNone": "снять",
    "setup.round": "Раунд",
    "setup.word": "Слово",
    "setup.allWords": "все слова",
    "setup.mode": "Режим",
    "setup.mode.drag": "перетаскивание",
    "setup.mode.type": "ввод с клавиатуры",
    "setup.count": "Сколько пропусков (примерно)",
    "setup.kind": "Что включать",
    "setup.kind.all": "всё",
    "setup.kind.sentence": "предложения",
    "setup.kind.text": "тексты",
    "setup.bank": "Банк слов",
    "setup.bank.answers": "только ответы",
    "setup.bank.distractors": "+ лишние формы",
    "setup.hints": "Показывать начальную форму под пропуском",
    "setup.start": "Начать",
    "setup.pool": "в базе: {items}, {gaps}",
    "setup.poolEmpty": "выберите хотя бы одну тему",
    "setup.noTopics": "В папке data/ нет ни одной темы.",
    "setup.loadErrors": "Ошибки в файлах базы: {n}",
    "setup.sentences": "{n} предл.",
    "setup.texts": "{n} текст.",
    "setup.ref": "справка",
    "setup.refTitle": "Грамматическая справка",
    "setup.lemmaOption": "{label} — {gaps}",

    "plural.item": ["задание", "задания", "заданий"],
    "plural.gap": ["пропуск", "пропуска", "пропусков"],

    "round.word": "слово «{word}»",
    "round.ref": "справка",
    "round.progress": "заполнено {filled} из {total}",
    "round.bank": "Банк слов",
    "round.letters": "Литовские буквы",
    "round.lettersLabel": "Литовские буквы:",
    "round.gap": "пропуск",
    "round.gapHint": "пропуск, начальная форма: {hint}",
    "round.gapFilled": "пропуск: {word}",
    "round.gapEmpty": "пустой пропуск",
    "round.check": "Проверить",
    "round.fix": "Исправить ошибки",
    "round.reveal": "Показать ответы",
    "round.again": "Новый раунд",
    "round.toSetup": "К настройкам",
    "round.perfect": "Puiku! Всё верно с первой попытки.",
    "round.allCorrect": "Теперь всё верно!",
    "round.score": "Верно {score}",
    "round.scoreOf": "{correct} из {total}",
    "round.firstTry": " (с первой попытки: {n})",

    "refs.title": "Грамматическая справка",
    "refs.none": "В папке data/ пока нет ни одной справки (.md).",
    "refs.usedBy": "к теме: {topics}",
    "refs.close": "Закрыть",

    "stats.title": "Статистика по темам",
    "stats.reset": "сбросить",
    "stats.note": "Считаются ответы при первой проверке каждого раунда. Хранится в этом браузере.",
    "stats.empty": "Пока нет ни одного завершённого раунда.",
    "stats.topic": "Тема",
    "stats.rounds": "Раундов",
    "stats.gaps": "Пропусков",
    "stats.correct": "Верно",
    "stats.last": "Последний раз",
    "stats.confirmReset": "Сбросить всю статистику?",
  },

  be: {
    "doc.title": "Spragos — трэнажор літоўскай граматыкі",
    "lang.label": "Мова інтэрфейсу",
    "nav.home": "На галоўную",
    "nav.setup": "Практыкаванне",
    "nav.refs": "Даведка",
    "nav.stats": "Статыстыка",

    "home.kicker": "міні-трэнажор літоўскай граматыкі",
    "home.lead": "<em>Spragos</em> па-літоўску азначае «пропускі»: і ў тэксце, і ў ведах. Асноўная механіка на дадзены момант — сказы з пропускамі: перацягніце ў кожны пропуск слова ў правільнай форме або ўпішыце яго з клавіятуры. Цяпер ёсць практыкаванні на скланенне назоўнікаў, прыметнікаў, займеннікаў і лічэбнікаў, больш за 500 пропускаў на кожную тэму.",
    "home.start": "Пачаць практыкаванне",
    "home.refs": "Граматычная даведка",
    "home.about.title": "Што гэта",
    "home.about.text": "Невялікі трэнажор, які быў зроблены мной з дапамогай Claude для ўласнай падрыхтоўкі да экзамену па літоўскай мове, калі спатрэбілася хутка прайсціся па пэўных тэмах. Ім можа карыстацца хто заўгодна.",
    "home.about.noAccount": "<strong>Без рэгістрацыі.</strong> Акаўнт не патрэбны, ніякія даныя нікуды не адпраўляюцца.",
    "home.about.stats": "<strong>Статыстыка захоўваецца толькі ў вашым браўзеры.</strong> На іншай прыладзе або ў іншым браўзеры яна будзе свая; ачыстка даных сайта яе сатрэ.",
    "home.about.mobile": "<strong>Працуе на тэлефоне:</strong> словы можна перацягваць пальцам або проста націснуць на слова, а потым на пропуск.",
    "home.about.modes": "<strong>Два рэжымы:</strong> перацягванне слоў з банка або ўвод з клавіятуры. Для літоўскіх літар (ą, č, ę, ė, į, š, ų, ū, ž) ёсць панэль, калі іх няма на клавіятуры.",
    "home.warn.title": "Важна пра матэрыялы",
    "home.warn.ai": "Заданні і даведкі <strong>цалкам згенераваныя ШІ</strong> і <strong>не правяраліся носьбітамі мовы</strong>. Кожная форма ў адказах аўтаматычна зверана з табліцамі скланення з падручнікаў, але памылкі ў выбары склону або ненатуральныя фразы ўсё ж магчымыя.",
    "home.warn.books": "Каб прыклады былі як мага больш правільнымі, частка сказаў узятая з падручнікаў, знойдзеных у вольным доступе ў інтэрнэце, <strong>даслоўна або амаль даслоўна</strong>. Правы на іх належаць аўтарам гэтых кніг, таму пры капіраванні і выкарыстанні матэрыялаў будзьце асцярожныя.",
    "home.warn.sources": "Крыніцы: Žingsnis I–II, Sėkmės, Langas į lietuvių kalbą, Lietuvių kalba dialoguose, Ne dienos be lietuvių kalbos, Skaitome ir klausome lietuviškai, Mano ir tavo šalis Lietuva, Complete Lithuanian, Colloquial Lithuanian.",
    "home.license.title": "Ліцэнзія",
    "home.license.text": "Карыстацца, капіяваць і перарабляць можна як заўгодна. Усё даецца «як ёсць»: могуць быць памылкі як у кодзе, так і ў заданнях.",
    "home.license.code": "<strong>Код</strong> — ліцэнзія <a href=\"https://opensource.org/license/mit\" target=\"_blank\" rel=\"noopener\">MIT</a>.",
    "home.license.content": "<strong>Заданні і даведкі</strong> — <a href=\"https://creativecommons.org/publicdomain/zero/1.0/deed.be\" target=\"_blank\" rel=\"noopener\">CC0 1.0</a> (грамадскі набытак), акрамя фраз, узятых з падручнікаў: правы на іх захоўваюцца за аўтарамі.",
    "home.license.source": "Зыходны код і база заданняў: <a href=\"https://github.com/jekhor/spragos\" target=\"_blank\" rel=\"noopener\">github.com/jekhor/spragos</a>.",

    "setup.topics": "Тэмы",
    "setup.selectAll": "выбраць усе",
    "setup.selectNone": "зняць",
    "setup.round": "Раўнд",
    "setup.word": "Слова",
    "setup.allWords": "усе словы",
    "setup.mode": "Рэжым",
    "setup.mode.drag": "перацягванне",
    "setup.mode.type": "увод з клавіятуры",
    "setup.count": "Колькі пропускаў (прыкладна)",
    "setup.kind": "Што ўключаць",
    "setup.kind.all": "усё",
    "setup.kind.sentence": "сказы",
    "setup.kind.text": "тэксты",
    "setup.bank": "Банк слоў",
    "setup.bank.answers": "толькі адказы",
    "setup.bank.distractors": "+ лішнія формы",
    "setup.hints": "Паказваць пачатковую форму пад пропускам",
    "setup.start": "Пачаць",
    "setup.pool": "у базе: {items}, {gaps}",
    "setup.poolEmpty": "выберыце хаця б адну тэму",
    "setup.noTopics": "У тэчцы data/ няма ніводнай тэмы.",
    "setup.loadErrors": "Памылкі ў файлах базы: {n}",
    "setup.sentences": "{n} сказ.",
    "setup.texts": "{n} тэкст.",
    "setup.ref": "даведка",
    "setup.refTitle": "Граматычная даведка",
    "setup.lemmaOption": "{label} — {gaps}",

    "plural.item": ["заданне", "заданні", "заданняў"],
    "plural.gap": ["пропуск", "пропускі", "пропускаў"],

    "round.word": "слова «{word}»",
    "round.ref": "даведка",
    "round.progress": "запоўнена {filled} з {total}",
    "round.bank": "Банк слоў",
    "round.letters": "Літоўскія літары",
    "round.lettersLabel": "Літоўскія літары:",
    "round.gap": "пропуск",
    "round.gapHint": "пропуск, пачатковая форма: {hint}",
    "round.gapFilled": "пропуск: {word}",
    "round.gapEmpty": "пусты пропуск",
    "round.check": "Праверыць",
    "round.fix": "Выправіць памылкі",
    "round.reveal": "Паказаць адказы",
    "round.again": "Новы раўнд",
    "round.toSetup": "Да налад",
    "round.perfect": "Puiku! Усё правільна з першай спробы.",
    "round.allCorrect": "Цяпер усё правільна!",
    "round.score": "Правільна {score}",
    "round.scoreOf": "{correct} з {total}",
    "round.firstTry": " (з першай спробы: {n})",

    "refs.title": "Граматычная даведка",
    "refs.none": "У тэчцы data/ пакуль няма ніводнай даведкі (.md).",
    "refs.usedBy": "да тэмы: {topics}",
    "refs.close": "Закрыць",

    "stats.title": "Статыстыка па тэмах",
    "stats.reset": "скінуць",
    "stats.note": "Улічваюцца адказы пры першай праверцы кожнага раўнда. Захоўваецца ў гэтым браўзеры.",
    "stats.empty": "Пакуль няма ніводнага завершанага раўнда.",
    "stats.topic": "Тэма",
    "stats.rounds": "Раўндаў",
    "stats.gaps": "Пропускаў",
    "stats.correct": "Правільна",
    "stats.last": "Апошні раз",
    "stats.confirmReset": "Скінуць усю статыстыку?",
  },
};

export const LOCALES = { ru: "ru-RU", be: "be-BY" };

let current = DEFAULT_LANG;

export function setLang(lang) {
  current = LANGS[lang] ? lang : DEFAULT_LANG;
  return current;
}

export function getLang() {
  return current;
}

// Язык по умолчанию — первый из языков браузера, для которого есть перевод.
export function detectLang(preferred = []) {
  for (const tag of preferred) {
    const base = String(tag).toLowerCase().split(/[-_]/)[0];
    if (LANGS[base]) return base;
  }
  return DEFAULT_LANG;
}

// Строка или массив форм на текущем языке; если ключа нет — из языка по умолчанию.
export function raw(key, lang = current) {
  return STRINGS[lang]?.[key] ?? STRINGS[DEFAULT_LANG][key];
}

export function t(key, params = {}, lang = current) {
  const s = raw(key, lang);
  if (typeof s !== "string") return key;
  return s.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}

// «5 пропусков»: число и слово в нужной форме.
export function plural(n, key, lang = current) {
  const [one, few, many] = raw(key, lang);
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${word}`;
}

export function keys(lang) {
  return Object.keys(STRINGS[lang] || {});
}
