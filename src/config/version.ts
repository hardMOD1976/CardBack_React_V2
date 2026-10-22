export interface VersionInfo {
  version: string;
  buildDate: string;
  environment: string;
  releaseTitle: string;
  testableFeatures: {
    title: string;
    description: string;
    status: 'ready' | 'updated' | 'in_progress';
    tags: string[];
  }[];
  changelog: {
    version: string;
    date: string;
    title: string;
    highlights: string[];
  }[];
}

export const APP_VERSION: VersionInfo = {
  version: 'v2.5.1',
  buildDate: '2026-10-03',
  environment: 'Production Cloud Run',
  releaseTitle: 'Header Lleuger, Tema a Perfil, Persistència i Selector de Portada',
  testableFeatures: [
    {
      title: 'Creació de figures a mà amb selecció de foto de portada',
      description: 'A la finestra "Afegir figura a mà", puja fotos i fes clic al botó "Fer portada" o comprova la xapa daurada "Portada". La imatge escollida es desa com a imatge principal tant a la col·lecció com al catàleg.',
      status: 'updated',
      tags: ['Col·lecció', 'Formulari a mà', 'Foto Portada']
    },
    {
      title: 'Persistència garantida de figures afegides',
      description: 'Les figures que afegeixes a mà persisteixen en recarregar la pàgina (emmagatzematge local persistent i sincronització Neon PostgreSQL) sense desaparèixer mai de la llista.',
      status: 'updated',
      tags: ['Persistència', 'Offline-First', 'Base de Dades']
    },
    {
      title: 'Capçalera lleugera i accés directe al logout',
      description: 'El Header s\'ha desobstruït (eliminat l\'escàner redundant i el commutador de tema) per garantir que la icona d\'usuari i el botó de tancar sessió (logout) estiguin sempre visibles sense scroll horitzontal.',
      status: 'updated',
      tags: ['UI', 'Header', 'Logout']
    },
    {
      title: 'Canvi de tema (Clar / Fosc) i Skins des del Perfil',
      description: 'Ves a "Perfil & Ajustos" per canviar entre Mode Clar i Mode Fosc i triar estils visuals vintage com Kenner \'78 Cardback o Neon \'84 Synthwave.',
      status: 'updated',
      tags: ['Perfil', 'Mode Clar/Fosc', 'Kenner 78']
    },
    {
      title: 'Reconeixement fotogràfic amb Google Lens (IA)',
      description: 'Analitza qualsevol fotografia d\'una figura, motlle o blíster per detectar el personatge, variant, accessoris originals i valoració de mercat en segons.',
      status: 'ready',
      tags: ['Google Lens', 'Visió IA', 'Multimodal']
    }
  ],
  changelog: [
    {
      version: 'v2.5.1',
      date: '2026-10-03',
      title: 'Optimització d\'UI, canvi de tema a perfil i visibilitat de versió',
      highlights: [
        'Eliminat l\'escàner redundant del Header (ja disponible al menú lateral i en afegir figura).',
        'Traslladat el canvi de tema (Clar / Fosc) a la pantalla de Perfil & Ajustos amb controls visuals dedicats.',
        'Eliminat el desbordament i scroll horitzontal del Header: la icona d\'usuari i el logout són 100% accessibles.',
        'Indicador de versió desplegada v2.5.1 visible a tots els dispositius (mòbil i escriptori) amb informació de proves.'
      ]
    },
    {
      version: 'v2.5.0',
      date: '2026-10-03',
      title: 'Correccions de persistència, portada i estabilitat d\'IA',
      highlights: [
        'Restaurada i millorada l\'opció per escollir la foto de portada a la creació manual de figures amb botons sempre visibles.',
        'Garantida la persistència de les figures noves al catàleg comunitari i a la col·lecció personal.',
        'Hash criptogràfic d\'imatges complet per evitar col·lisions en memòria cau de reconeixement visual.',
        'Afegit control de versions i llista de funcionalitats testejarles.'
      ]
    },
    {
      version: 'v2.4.0',
      date: '2026-10-02',
      title: 'Desxifrador Kenner i millores de càmera',
      highlights: [
        'Integrat l\'assortiment Kenner POTF2 #69570 i el desxifrador universal de referències.',
        'Detecció d\'entorn (escriptori vs mòbil) amb timeout de 5 segons per evitar l\'espera infinita a webcams de PC.',
        'Eliminats falsos positius de personatges a partir de les galeries de cardbacks.'
      ]
    }
  ]
};
