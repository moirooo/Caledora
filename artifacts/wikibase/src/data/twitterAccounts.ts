export type TwitterAccountCategory =
  | 'WIKI_OFFICIAL'
  | 'MERCATO_GLOBAL'
  | 'FRANCE_INSIDERS_MEDIAS'
  | 'UK_INSIDERS_MEDIAS'
  | 'SPAIN_INSIDERS_MEDIAS'
  | 'ITALY_INSIDERS_MEDIAS'
  | 'GERMANY_INSIDERS_MEDIAS'
  | 'DATA_TACTICS_INVESTIGATION';

export type TwitterAccountRecord = {
  name: string;
  handle: string;
  category: TwitterAccountCategory;
  country?: 'FR' | 'UK' | 'ES' | 'IT' | 'DE' | 'GLOBAL';
  badge: 'gold' | 'blue' | null;
};

type AccountSeed = readonly [name: string, handle: string];

const groups: Array<{
  category: TwitterAccountCategory;
  country?: TwitterAccountRecord['country'];
  badge: TwitterAccountRecord['badge'];
  accounts: readonly AccountSeed[];
}> = [
  {
    category: 'MERCATO_GLOBAL',
    country: 'GLOBAL',
    badge: 'blue',
    accounts: [
      ['Fabrizio Romano', '@FabrizioRomano'], ['David Ornstein', '@David_Ornstein'],
      ['Matteo Moretto', '@MatteMoretto'], ['Gianluca Di Marzio', '@DiMarzio'],
      ['Florian Plettenberg', '@Plettigoal'], ['Ben Jacobs', '@JacobsBen'],
      ['Sacha Tavolieri', '@sachatavolieri'], ['Nicolò Schira', '@NicoSchira'],
      ['Ekrem Konur', '@Ekremkonur'], ['Patrick Berger', '@berger_pj'],
    ],
  },
  {
    category: 'FRANCE_INSIDERS_MEDIAS',
    country: 'FR',
    badge: 'blue',
    accounts: [
      ['Fabrice Hawkins', '@FabriceHawkins'], ['Loïc Tanzi', '@Tanziloic'],
      ['Saber Desfarges', '@SaberDesfa'], ['Santi Aouna', '@Santi_J_FM'],
      ['Sébastien Denis', '@sebnonda'], ['Julien Froment', '@JulienFroment'],
      ['Julien Laurens', '@LaurensJulien'], ['Bertrand Latour', '@LatourBertrand'],
      ['Hugo Guillemet', '@hugoguillemet'], ['Mathieu Grégoire', '@garscome'],
      ['Benjamin Quarez', '@B_Quarez'], ['Marc Mechenoua', '@LeMechenoua'],
      ['Arthur Perrot', '@ArthurPerrot'], ['Adrien Chantegrelet', '@Adrientp'],
      ['Florent Torchut', '@FlorentTorchut'], ['Alexandre Aflalo', '@AleAflalo'],
      ['Bruno Salomon', '@Brunsalomon'], ['Guillaume MP', '@Guillaumemp'],
      ['Nabil Djellit', '@Nabil_djellit'], ['L’Équipe', '@lequipe'],
      ['RMC Sport', '@RMCsport'], ['Foot Mercato', '@footmercato'],
      ['So Foot', '@sofoot'], ['Actu Foot', '@ActuFoot_'], ['After Foot RMC', '@AfterRMC'],
      ['Winamax FC', '@WinamaxFC'], ['Le Club des 5', '@LeClubDes_5'],
      ['Le Média Carré', '@lemediacarre'], ['Eurosport France', '@Eurosport_FR'],
      ['Téléfoot', '@telefoot_TF1'], ['Canal Football Club', '@CanalFootClub'],
      ['CulturePSG', '@CulturePSG'], ['Le Phocéen', '@lephoceen'],
      ['Olympique-et-Lyonnais', '@oetl'],
    ],
  },
  {
    category: 'UK_INSIDERS_MEDIAS',
    country: 'UK',
    badge: 'blue',
    accounts: [
      ['Henry Winter', '@henrywinter'], ['James Pearce', '@JamesPearceLFC'],
      ['Sam Lee', '@SamLee'], ['Laurie Whitwell', '@lauriewhitwell'],
      ['Sami Mokbel', '@SamiMokbel81_DM'], ['John Percy', '@JPercyTelegraph'],
      ['Matt Law', '@Matt_Law_DT'], ['Jason Burt', '@JBurtTelegraph'],
      ['Adam Crafton', '@AdamCrafton_'], ['Miguel Delaney', '@MiguelDelaney'],
      ['Jonathan Wilson', '@jonawils'], ['Simon Stone', '@sistoney67'],
      ['Rob Dawson', '@RobDawsonESPN'], ['Melissa Reddy', '@MelissaReddy_'],
      ['Phil Hay', '@PhilHay_'], ['Jacob Steinberg', '@JacobSteinberg'],
      ['David Anderson', '@danderson87'], ['The Athletic FC', '@TheAthleticFC'],
      ['BBC Sport', '@BBCSport'], ['Sky Sports Premier League', '@SkySportsPL'],
      ['Sky Sports News', '@SkySportsNews'], ['The Guardian Sport', '@guardian_sport'],
      ['The Telegraph Football', '@TeleFootball'], ['Tifo Football', '@TifoFootball_'],
      ['The Overlap', '@WeAreTheOverlap'], ['COPA90', '@Copa90'],
      ['AFTV', '@AFTVMedia'], ['FootballJOE', '@FootballJOE'],
      ["That's Football", '@ThatsFootballTV'], ['GOAL', '@goal'],
    ],
  },
  {
    category: 'SPAIN_INSIDERS_MEDIAS',
    country: 'ES',
    badge: 'blue',
    accounts: [
      ['Gerard Romero', '@gerardromero'], ['Mario Cortegana', '@MarioCortegana'],
      ['Sid Lowe', '@sidlowe'], ['Guillem Balague', '@GuillemBalague'],
      ['Josep Pedrerol', '@jpedrerol'], ['Edu Aguirre', '@EduAguirre7'],
      ['Helena Condis Edo', '@HelenaCondis'], ['Toni Juanmartí', '@tjuanmarti'],
      ['Guillermo Rai', '@GuillermoRai_'], ['Sergio Santos', '@Santos_Relevo'],
      ['Alfredo Martínez', '@Alfremartinezz'], ['Carlos Carpio', '@Carpio_Marca'],
      ['Marcos Durán', '@marcosduran_'], ['Relevo', '@relevo'], ['MARCA', '@marca'],
      ['Diario AS', '@diarioas'], ['Mundo Deportivo', '@mundodeportivo'],
      ['SPORT', '@sport'], ['El Chiringuito TV', '@elchiringuitotv'],
      ['El Larguero', '@ellarguero'], ['El Partidazo de COPE', '@partidazocope'],
      ['Jijantes FC', '@JijantesFC'], ['Panenka', '@RevistaPanenka'],
    ],
  },
  {
    category: 'ITALY_INSIDERS_MEDIAS',
    country: 'IT',
    badge: 'blue',
    accounts: [
      ['Romeo Agresti', '@romeoagresti'], ['Daniele Longo', '@86_longo'],
      ['Alfredo Pedullà', '@AlfredoPedulla'], ['James Horncastle', '@JamesHorncastle'],
      ['Fabrizio Biasin', '@FBiasin'], ['Gianluigi Longari', '@Glongari'],
      ['Carlo Pellegatti', '@PellegattiCarlo'], ['Antonio Vitiello', '@AntoVitiello'],
      ['Giovanni Albanese', '@GiovaAlbanese'], ['Mirko Calemme', '@mirkocalemme'],
      ['Pasquale Guarro', '@PasqualeGuarro'], ['Tancredi Palmeri', '@tancredipalmeri'],
      ['La Gazzetta dello Sport', '@Gazzetta_it'], ['Corriere dello Sport', '@CorSport'],
      ['Tuttosport', '@tuttosport'], ['Sky Sport', '@SkySport'],
      ['Sportitalia', '@tvdellosport'], ['Calciomercato.com', '@cmdotcom'],
      ['Cronache di spogliatoio', '@CronacheTweet'], ['Ultimo Uomo', '@UltimoUomo'],
      ['SOS Fanta', '@SOSFanta'],
    ],
  },
  {
    category: 'GERMANY_INSIDERS_MEDIAS',
    country: 'DE',
    badge: 'blue',
    accounts: [
      ['Christian Falk', '@cfbayern'], ['Kerry Hau', '@kerry_hau'],
      ['Tobi Altschäffl', '@altobelli13'], ['Raphael Honigstein', '@honigstein'],
      ['Archie Rhind-Tutt', '@archiert1'], ['Manuel Bonke', '@mano_bonke'],
      ['Philipp Hinze', '@philipphinze24'], ['Dennis Bayer', '@DennisBayer'],
      ['Guido Schäfer', '@schfer_g'], ['Kicker', '@kicker'], ['BILD Sport', '@BILD_Sport'],
      ['Sky Sport DE', '@SkySportDE'], ['Sport1', '@SPORT1'],
      ['11Freunde', '@11Freunde_de'], ['Spox', '@spox'],
    ],
  },
  {
    category: 'DATA_TACTICS_INVESTIGATION',
    country: 'GLOBAL',
    badge: 'blue',
    accounts: [
      ['Romain Molina', '@Romain_Molina'], ['Kieran Maguire', '@KieranMaguire'],
      ['Tariq Panja', '@tariqpanja'], ['Philippe Auclair', '@PhilippeAuclair'],
      ['Nick Harris', '@sportingintel'], ['Swiss Ramble', '@SwissRamble'],
      ['Josimar Football', '@JosimarFoot'], ['Off The Pitch', '@OffThePitch_com'],
      ['Florent Toniutti', '@LeScripts'], ['Elias Baillif', '@Elias_B09'],
      ['Michael Cox', '@Zonal_Marking'], ['Seb Stafford-Bloor', '@SebSB'],
      ['Jacek Kulig', '@FTalentScout'], ['Ben Mattinson', '@Ben_Mattinson_'],
      ['Opta Analyst', '@OptaAnalyst'], ['OptaJean', '@OptaJean'],
      ['OptaJoe', '@OptaJoe'], ['OptaJose', '@OptaJose'],
      ['StatsBomb', '@StatsBomb'], ['Squawka', '@Squawka'],
      ["Data'Foot", '@DataFoot_'], ['Statsdufoot', '@Statsdufoot'],
      ['Spielverlagerung', '@spielvercom'], ['Between The Posts', '@BetweenThePosts'],
      ['Breaking The Lines', '@BTLvid'], ['Smarterscout', '@Smarterscout'],
      ['Target Scouting', '@TargetScouting_'],
    ],
  },
];

export const TWITTER_ACCOUNTS: TwitterAccountRecord[] = groups.flatMap(group =>
  group.accounts.map(([name, handle]) => ({
    name,
    handle,
    category: group.category,
    country: group.country,
    badge: group.badge,
  })),
);

export const TWITTER_ACCOUNT_TEMPLATES = {
  CLUB_ACTU: ['Actu', 'Zone', 'Source', 'Inside', 'Xtra', 'Focus', '_FR', 'Hub', 'HQ', 'Daily', 'Chronicles', 'Media', 'Nation', 'Infocenter', 'Report'],
  PLAYER_FAN: ['Era', 'Zone', 'Prime', 'Magic', 'Cult', 'Archive', 'Central', 'Source', 'Legacy', 'Muse', 'Propaganda', 'Matrix', 'Outdated', 'Universe', 'Gems'],
  VIDEO: ['Comps', 'Vids', 'Edits', 'Vids', 'Goals', 'Touch', 'Showtime', 'Clips', 'RawFootage', 'Skills_'],
  TACTICS: ['Tactics', 'Lab', 'Scout', 'Metrics', 'Scouting', 'Analysis', 'Vision', 'Stats', 'Data_FR', 'Radar'],
  REACTIONS: ['Talk', 'Space', 'Debrief', 'Vibes', 'FC', 'Opinions', 'Reaction', 'NoContext', 'Memes', 'Trolls'],
} as const;