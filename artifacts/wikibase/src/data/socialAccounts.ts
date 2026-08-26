import type { InstagramProfile } from '@/services/instagramStorage';

export type SocialAccountGroup = {
  id: string;
  label: string;
  keywords: string[];
  accounts: ReadonlyArray<readonly [displayName: string, username: string]>;
};

export const socialAccountGroups: readonly SocialAccountGroup[] = [
  { id: 'caledora-journalists', label: 'Caledora · journalistes & insiders', keywords: ['caledora', 'calédora', 'caledorien', 'caledorienne', 'insider caledora', 'mercato caledora', 'ligue caledora', 'caledora fc'], accounts: [
    ['Lucas Vaneck', 'LucasVaneck_'], ['Mateo Cassani', 'MateoCassaniFoot'], ['Adrien Solal', 'AdrienSolal_CAL'], ['Dario Benitez', 'BenitezInside'], ['Marc Valadier', 'ValadierSport'], ['Sébastien Alcaraz', 'AlcarazMedia'], ['Yanis Belkacem', 'YBelkacem_'], ['Romain Cazaux', 'CazauxMercato'], ['Hugo Vernet', 'HugoVernetFoot'], ['Alexandre Moratti', 'Moratti_CAL'],
  ] },
  { id: 'caledora-media', label: 'Caledora · médias, presse & émissions', keywords: ['média caledora', 'media caledora', 'presse caledora', 'caledora sport', 'caledora', 'caledora fc'], accounts: [
    ['Caledora Sport 24', 'CaledoraSport24'], ['La Voix de Caledora', 'VoixCaledora'], ['Le Quotidien Calédorien', 'QuotidienCAL'], ['Caledora Tribune', 'CaledoraTribune'], ['After Foot Caledora', 'AfterCaledora'], ['Caledora TV Sport', 'CaledoraTVSport'], ['100% Caledora FC', '100CaledoraFC'], ['Riviera Foot News', 'RivieraFootNews'], ['Radio Caledora Sport', 'RadioCalSport'], ['Tribune Sud Caledora', 'TribuneSudCAL'],
  ] },
  { id: 'insiders-global', label: 'Insiders mercato & transferts globaux', keywords: ['insider', 'mercato', 'transfert', 'transferts', 'transfer'], accounts: [
    ['Fabrizio Romano', 'FabrizioRomano'], ['David Ornstein', 'David_Ornstein'], ['Matteo Moretto', 'MatteMoretto'], ['Gianluca Di Marzio', 'DiMarzio'], ['Florian Plettenberg', 'Plettigoal'], ['Ben Jacobs', 'JacobsBen'], ['Sacha Tavolieri', 'sachatavolieri'], ['Nicolò Schira', 'NicoSchira'], ['Ekrem Konur', 'Ekremkonur'], ['Patrick Berger', 'berger_pj'],
  ] },
  { id: 'france-journalists', label: 'France · journalistes & insiders', keywords: ['france', 'français', 'francaise', 'journaliste français', 'journaliste francais', 'ligue 1'], accounts: [
    ['Fabrice Hawkins', 'FabriceHawkins'], ['Loïc Tanzi', 'Tanziloic'], ['Saber Desfarges', 'SaberDesfa'], ['Santi Aouna', 'Santi_J_FM'], ['Sébastien Denis', 'sebnonda'], ['Julien Froment', 'JulienFroment'], ['Julien Laurens', 'LaurensJulien'], ['Bertrand Latour', 'LatourBertrand'], ['Hugo Guillemet', 'hugoguillemet'], ['Mathieu Grégoire', 'garscome'], ['Benjamin Quarez', 'B_Quarez'], ['Marc Mechenoua', 'LeMechenoua'], ['Arthur Perrot', 'ArthurPerrot'], ['Adrien Chantegrelet', 'Adrientp'], ['Florent Torchut', 'FlorentTorchut'], ['Alexandre Aflalo', 'AleAflalo'], ['Bruno Salomon', 'Brunsalomon'], ['Guillaume MP', 'Guillaumemp'], ['Nabil Djellit', 'Nabil_djellit'],
  ] },
  { id: 'france-media', label: 'France · médias, émissions & collectifs', keywords: ['média français', 'media français', 'média france', 'media france', 'france'], accounts: [
    ["L'Équipe", 'lequipe'], ['RMC Sport', 'RMCsport'], ['Foot Mercato', 'footmercato'], ['So Foot', 'sofoot'], ['Actu Foot', 'ActuFoot_'], ['After Foot RMC', 'AfterRMC'], ['Winamax FC', 'WinamaxFC'], ['Le Club des 5', 'LeClubDes_5'], ['Le Média Carré', 'lemediacarre'], ['Eurosport France', 'Eurosport_FR'], ['Téléfoot', 'telefoot_TF1'], ['Canal Football Club', 'CanalFootClub'], ['CulturePSG', 'CulturePSG'], ['Le Phocéen', 'lephoceen'], ['Olympique-et-Lyonnais', 'oetl'],
  ] },
  { id: 'england-journalists', label: 'Angleterre · journalistes & insiders', keywords: ['angleterre', 'anglais', 'premier league', 'english'], accounts: [
    ['Henry Winter', 'henrywinter'], ['James Pearce', 'JamesPearceLFC'], ['Sam Lee', 'SamLee'], ['Laurie Whitwell', 'lauriewhitwell'], ['Sami Mokbel', 'SamiMokbel81_DM'], ['John Percy', 'JPercyTelegraph'], ['Matt Law', 'Matt_Law_DT'], ['Jason Burt', 'JBurtTelegraph'], ['Adam Crafton', 'AdamCrafton_'], ['Miguel Delaney', 'MiguelDelaney'], ['Jonathan Wilson', 'jonawils'], ['Simon Stone', 'sistoney67'], ['Rob Dawson', 'RobDawsonESPN'], ['Melissa Reddy', 'MelissaReddy_'], ['Phil Hay', 'PhilHay_'], ['Jacob Steinberg', 'JacobSteinberg'], ['David Anderson', 'danderson87'],
  ] },
  { id: 'england-media', label: 'Angleterre · médias, chaînes & collectifs', keywords: ['média anglais', 'media anglais', 'premier league', 'angleterre'], accounts: [
    ['The Athletic FC', 'TheAthleticFC'], ['BBC Sport', 'BBCSport'], ['Sky Sports Premier League', 'SkySportsPL'], ['Sky Sports News', 'SkySportsNews'], ['The Guardian Sport', 'guardian_sport'], ['The Telegraph Football', 'TeleFootball'], ['Tifo Football', 'TifoFootball_'], ['The Overlap', 'WeAreTheOverlap'], ['COPA90', 'COPA90'], ['AFTV', 'AFTVMedia'], ['FootballJOE', 'FootballJOE'], ["That's Football", 'ThatsFootballTV'], ['GOAL', 'goal'],
  ] },
  { id: 'spain-journalists', label: 'Espagne · journalistes & insiders', keywords: ['espagne', 'espagnol', 'espagnole', 'la liga'], accounts: [
    ['Gerard Romero', 'gerardromero'], ['Mario Cortegana', 'MarioCortegana'], ['Sid Lowe', 'sidlowe'], ['Guillem Balague', 'GuillemBalague'], ['Josep Pedrerol', 'jpedrerol'], ['Edu Aguirre', 'EduAguirre7'], ['Helena Condis Edo', 'HelenaCondis'], ['Toni Juanmartí', 'tjuanmarti'], ['Guillermo Rai', 'GuillermoRai_'], ['Sergio Santos', 'Santos_Relevo'], ['Alfredo Martínez', 'Alfremartinezz'], ['Carlos Carpio', 'Carpio_Marca'], ['Marcos Durán', 'marcosduran_'],
  ] },
  { id: 'spain-media', label: 'Espagne · médias & émissions', keywords: ['média espagnol', 'media espagnol', 'espagne', 'la liga'], accounts: [
    ['Relevo', 'relevo'], ['MARCA', 'marca'], ['Diario AS', 'diarioas'], ['Mundo Deportivo', 'mundodeportivo'], ['SPORT', 'sport'], ['El Chiringuito TV', 'elchiringuitotv'], ['El Larguero', 'ellarguero'], ['El Partidazo de COPE', 'partidazocope'], ['Jijantes FC', 'JijantesFC'], ['Panenka', 'RevistaPanenka'],
  ] },
  { id: 'italy-journalists', label: 'Italie · journalistes & insiders', keywords: ['italie', 'italien', 'italienne', 'serie a'], accounts: [
    ['Romeo Agresti', 'romeoagresti'], ['Daniele Longo', '86_longo'], ['Alfredo Pedullà', 'AlfredoPedulla'], ['James Horncastle', 'JamesHorncastle'], ['Fabrizio Biasin', 'FBiasin'], ['Gianluigi Longari', 'Glongari'], ['Carlo Pellegatti', 'PellegattiCarlo'], ['Antonio Vitiello', 'AntoVitiello'], ['Giovanni Albanese', 'GiovaAlbanese'], ['Mirko Calemme', 'mirkocalemme'], ['Pasquale Guarro', 'PasqualeGuarro'], ['Tancredi Palmeri', 'tancredipalmeri'],
  ] },
  { id: 'italy-media', label: 'Italie · médias & collectifs', keywords: ['média italien', 'media italien', 'italie', 'serie a'], accounts: [
    ['La Gazzetta dello Sport', 'Gazzetta_it'], ['Corriere dello Sport', 'CorSport'], ['Tuttosport', 'tuttosport'], ['Sky Sport', 'SkySport'], ['Sportitalia', 'tvdellosport'], ['Calciomercato.com', 'cmdotcom'], ['Cronache di spogliatoio', 'CronacheTweet'], ['Ultimo Uomo', 'UltimoUomo'], ['SOS Fanta', 'SOSFanta'],
  ] },
  { id: 'germany-journalists', label: 'Allemagne · journalistes & insiders', keywords: ['allemagne', 'allemand', 'bundesliga'], accounts: [
    ['Christian Falk', 'cfbayern'], ['Kerry Hau', 'kerry_hau'], ['Tobi Altschäffl', 'altobelli13'], ['Raphael Honigstein', 'honigstein'], ['Archie Rhind-Tutt', 'archiert1'], ['Manuel Bonke', 'mano_bonke'], ['Philipp Hinze', 'philipphinze24'], ['Dennis Bayer', 'DennisBayer'], ['Guido Schäfer', 'schfer_g'],
  ] },
  { id: 'germany-media', label: 'Allemagne · médias & publications', keywords: ['média allemand', 'media allemand', 'allemagne', 'bundesliga'], accounts: [
    ['Kicker', 'kicker'], ['BILD Sport', 'BILD_Sport'], ['Sky Sport DE', 'SkySportDE'], ['Sport1', 'SPORT1'], ['11Freunde', '11Freunde_de'], ['Spox', 'spox'],
  ] },
  { id: 'investigation', label: 'Investigation, économie & géopolitique du football', keywords: ['investigation', 'économie', 'economie', 'géopolitique', 'geopolitique', 'finance'], accounts: [
    ['Romain Molina', 'Romain_Molina'], ['Kieran Maguire', 'KieranMaguire'], ['Tariq Panja', 'tariqpanja'], ['Philippe Auclair', 'PhilippeAuclair'], ['Nick Harris', 'sportingintel'], ['Swiss Ramble', 'SwissRamble'], ['Josimar Football', 'JosimarFoot'], ['Off The Pitch', 'OffThePitch_com'],
  ] },
  { id: 'tactics-data', label: 'Scouting, analyse tactique & data', keywords: ['tactique', 'analyse', 'data', 'scouting', 'statistique', 'stats'], accounts: [
    ['Florent Toniutti', 'LeScripts'], ['Elias Baillif', 'Elias_B09'], ['Michael Cox', 'Zonal_Marking'], ['Seb Stafford-Bloor', 'SebSB'], ['Jacek Kulig', 'FTalentScout'], ['Ben Mattinson', 'Ben_Mattinson_'], ['Opta Analyst', 'OptaAnalyst'], ['OptaJean', 'OptaJean'], ['OptaJoe', 'OptaJoe'], ['OptaJose', 'OptaJose'], ['StatsBomb', 'StatsBomb'], ['Squawka', 'Squawka'], ["Data'Foot", 'DataFoot_'], ['Statsdufoot', 'Statsdufoot'], ['Spielverlagerung', 'spielvercom'], ['Between The Posts', 'BetweenThePosts'], ['Breaking The Lines', 'BTLvid'], ['Smarterscout', 'Smarterscout'], ['Target Scouting', 'TargetScouting_'],
  ] },
];

export const socialAccountTemplates = {
  clubNews: ['Actu', 'Zone', 'Source', 'Inside', 'Xtra', 'Focus', '_FR', 'Hub', 'HQ', 'Daily', 'Chronicles', 'Media', 'Nation', 'Infocenter', 'Report'],
  playerFans: ['Era', 'Zone', 'Prime', 'Magic', 'Cult', 'Archive', 'Central', 'Source', 'Legacy', 'Muse', 'Propaganda', 'Matrix', 'Outdated', 'Universe', 'Gems'],
  video: ['Comps', 'Vids', 'Edits', 'Goals', 'Touch', 'Showtime', 'Clips', 'RawFootage', 'Skills_'],
  tactics: ['Tactics', 'Lab', 'Scout', 'Metrics', 'Scouting', 'Analysis', 'Vision', 'Stats', 'Data_FR', 'Radar'],
  reactions: ['Talk', 'Space', 'Debrief', 'Vibes', 'FC', 'Opinions', 'Reaction', 'NoContext', 'Memes', 'Trolls'],
} as const;

const socialId = (username: string) => `social-${username.toLowerCase().replace(/[^a-z0-9._-]/g, '')}`;

export const socialAccountProfiles: InstagramProfile[] = socialAccountGroups.flatMap(group => group.accounts.map(([displayName, username], index) => ({
  id: socialId(username),
  username: username.toLowerCase(),
  displayName,
  verified: /media|insider|journalists|investigation|tactics-data|caledora/.test(group.id),
  accountType: 'média / presse',
  category: group.label,
  bio: `${group.label} · Compte de référence football`,
  avatar: 'profile.svg',
  reputation: 'populaire',
  personality: index % 5 === 0 ? 'provocateur' : 'corpo',
  communicationTone: 'institutionnel',
  status: 'populaire',
  followers: 14_000 + index * 1_350,
  following: 180 + index * 7,
  relations: [],
})));

const socialAccountProfileIds = new Set(socialAccountProfiles.map(profile => profile.id));

/** Reference accounts are generated data for AI comments, never selectable user profiles. */
export function isSocialAccountProfile(profile: Pick<InstagramProfile, 'id'>) {
  return socialAccountProfileIds.has(profile.id);
}

export function visibleInstagramProfiles<T extends Pick<InstagramProfile, 'id'>>(profiles: readonly T[]) {
  return profiles.filter(profile => !isSocialAccountProfile(profile));
}

export function socialAccountMatchesContext(context: string, profiles: InstagramProfile[]) {
  const normalized = context.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const requestedHandles = [...context.matchAll(/@([a-z0-9._]+)/gi)].map(match => match[1].toLowerCase());
  const explicitlyNamed = profiles.filter(profile => requestedHandles.includes(profile.username.toLowerCase())
    || normalized.includes(profile.username.toLowerCase())
    || normalized.includes(profile.displayName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  const matchingGroups = socialAccountGroups.filter(group => group.keywords.some(keyword => normalized.includes(keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())));
  const groupIds = new Set(matchingGroups.map(group => group.id));
  const contextual = profiles.filter(profile => socialAccountGroups.some(group => groupIds.has(group.id) && profile.category === group.label));
  return [...new Map([...explicitlyNamed, ...contextual].map(profile => [profile.id, profile])).values()];
}