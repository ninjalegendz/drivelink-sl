// The five explanations where money and liability are decided, in the three
// languages DriveLink's users actually read.
//
// Deliberately NOT a full interface translation. Comprehension collapses in a
// second language under financial anxiety, and the people most exposed are the
// first-time local renter and the private host with low digital confidence.
// Labels stay in English; the consequences do not.
//
// Sinhala and Tamil were produced with Gemini 3.7 Flash and have NOT been
// checked by a native speaker. Have someone read them before launch.

export const EXPLANATION_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
] as const;

export type ExplanationLanguage = (typeof EXPLANATION_LANGUAGES)[number]["code"];

export const EXPLANATIONS = {
  en: {
    deposit: "The refundable deposit is paid directly to the host or rental business at pickup, not to DriveLink. DriveLink never holds your money. The deposit is returned to you after the vehicle is checked back in, and the condition recorded at pickup and at return is what is used to settle any deduction.",
    documentSharing: "If you agree to share your documents, the Rental Page can view your identity document and driving licence for this booking only. Every view is stamped with their name and the time, and is listed in your document history. They cannot download a clean copy, and their access ends when the booking ends.",
    dispute: "If something goes wrong, raise it on the booking itself. DriveLink collects the evidence from both sides and reviews it. DriveLink does not hold the money and cannot take it from either party, so a decision is a recorded finding that both sides, and any later dispute, can rely on.",
  },
  si: {
    deposit: "ආපසු ගෙවන තැන්පතුව වාහනය ලබා ගන්නා අවස්ථාවේදී සෘජුවම වාහන හිමිකරුට හෝ කුලී ව්‍යාපාරයට ගෙවනු ලැබේ, DriveLink වෙත නොවේ. DriveLink කිසි විටෙකත් ඔබගේ මුදල් රඳවා නොගනී. වාහනය නැවත භාරදීමෙන් පසු තැන්පතුව ඔබට ආපසු ලබා දෙන අතර, කිසියම් අඩු කිරීමක් පියවීම සඳහා යොදාගනු ලබන්නේ වාහනය ලබා ගැනීමේදී සහ ආපසු භාරදීමේදී සටහන් කරගත් තත්ත්වයයි.",
    documentSharing: "ඔබගේ ලියකියවිලි බෙදා ගැනීමට ඔබ එකඟ වන්නේ නම්, මෙම වෙන්කරවා ගැනීමට පමණක් අදාළ වන පරිදි කුලී පිටුවට ඔබගේ හැඳුනුම්පත සහ රියදුරු බලපත්‍රය නැරඹිය හැකිය. සෑම නැරඹීමකදීම ඔවුන්ගේ නම සහ වේලාව සටහන් වන අතර එය ඔබගේ ලේඛන ඉතිහාසයේ ලැයිස්තුගත කෙරේ. ඔවුන්ට එහි පැහැදිලි පිටපතක් බාගත කළ නොහැකි අතර, වෙන්කරවා ගැනීමේ කාලය අවසන් වූ විට ඔවුන්ගේ ප්‍රවේශයද අවසන් වේ.",
    dispute: "යම් ගැටලුවක් මතු වුවහොත්, එම වෙන්කරවා ගැනීම තුළින්ම එය ඉදිරිපත් කරන්න. DriveLink දෙපාර්ශවයෙන්ම සාක්ෂි ලබාගෙන ඒවා සමාලෝචනය කරයි. DriveLink මුදල් රඳවා නොගන්නා අතර කිසිදු පාර්ශවයකින් එය ලබා ගැනීමටද නොහැක, එබැවින් දෙනු ලබන තීරණය යනු දෙපාර්ශවයටම සහ ඉදිරියේදී ඇතිවිය හැකි ඕනෑම ආරවුලකදී විශ්වාසය තැබිය හැකි සටහන්ගත නිගමනයකි.",
  },
  ta: {
    deposit: "மீளளிக்கக்கூடிய வைப்புத்தொகை வாகனம் எடுக்கும் போது நேரடியாக வாகன உரிமையாளருக்கு அல்லது வாடகை நிறுவனத்திற்கு செலுத்தப்படும், DriveLink இற்கு அல்ல. DriveLink ஒருபோதும் உங்கள் பணத்தை வைத்திருக்காது. வாகனம் மீண்டும் ஒப்படைக்கப்பட்ட பிறகு வைப்புத்தொகை உங்களுக்குத் திருப்பித் தரப்படும், ஏதேனும் பிடித்தங்களைச் சரிசெய்வதற்கு வாகனம் எடுக்கும்போதும் திரும்ப ஒப்படைக்கும்போதும் பதிவுசெய்யப்பட்ட வாகனத்தின் நிலையே பயன்படுத்தப்படும்.",
    documentSharing: "உங்கள் ஆவணங்களைப் பகிர நீங்கள் ஒப்புக்கொண்டால், இந்த முன்பதிவுக்கு மட்டுமே வாடகை பக்கமானது உங்கள் அடையாள ஆவணம் மற்றும் சாரதி அனுமதிப்பத்திரத்தைப் பார்க்க முடியும். ஒவ்வொரு முறை பார்க்கும்போதும் அவர்களின் பெயரும் நேரமும் குறிக்கப்பட்டு, உங்கள் ஆவண வரலாற்றில் பட்டியலிடப்படும். அவர்களால் தெளிவான பிரதியை பதிவிறக்கம் செய்ய முடியாது, மேலும் முன்பதிவு முடிந்ததும் அவர்களின் அணுகலும் முடிவடையும்.",
    dispute: "ஏதேனும் தவறு நடந்தால், அந்த முன்பதிவிலேயே அதைத் தெரிவியுங்கள். DriveLink இரு தரப்பிலிருந்தும் ஆதாரங்களைச் சேகரித்து மதிப்பாய்வு செய்யும். DriveLink பணத்தை வைத்திருக்காது மற்றும் எந்தத் தரப்பினரிடமிருந்தும் அதை எடுக்க முடியாது, எனவே எடுக்கப்படும் முடிவு என்பது இரு தரப்பினரும் மற்றும் பிற்கால தகராறுகளின் போதும் நம்பியிருக்கக்கூடிய ஒரு பதிவு செய்யப்பட்ட முடிவாகும்.",
  },
} as const;

export type ExplanationKey = keyof typeof EXPLANATIONS["en"];
