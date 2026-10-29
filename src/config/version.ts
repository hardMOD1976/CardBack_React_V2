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
  version: 'v2.7.0',
  buildDate: '2026-10-23',
  environment: 'Production Cloud Run',
  releaseTitle: "Navegació Automàtica a Detall, Panell de Propietari, Formulari d'Edició i Múltiples Fotos",
  testableFeatures: [
    {
      title: "Navegació Directa a la Fitxa de Detall en Afegir a la Col·lecció",
      description: "Quan afegeixes una figura a la teva col·lecció (des de Google Lens IA, des del Banc de Dades o des del formulari manual), l'aplicació et redirigeix automàticament a la pàgina de detall de la figura (/detail/figure/:id) perquè puguis revisar-la a l'instant.",
      status: 'updated',
      tags: ['Navegació', 'Detall', 'Google Lens', 'Col·lecció']
    },
    {
      title: "Panell Exclusiu d'Inventari per al Propietari de la Figura",
      description: "A la pàgina de detall de la figura, si l'usuari n'és el propietari, apareix un panell destacat amb insígnia de 'Propietari' que mostra el preu de compra, el valor estimat actual, la plusvàlua/revalorització, l'estat de conservació (MOC/Loose/Graded), la data d'adquisició, la quantitat, la ubicació i els comentaris o notes personals del col·leccionista.",
      status: 'ready',
      tags: ['Propietari', 'Inventari', 'Preu', 'Comentaris', 'Estat']
    },
    {
      title: "Formulari d'Edició Complet de la Figura per al Propietari",
      description: "Fent clic al botó 'Editar dades' (amb icona de llapis) a la fitxa de la figura, el propietari pot modificar cada element mitjançant un formulari modal complet: preu de compra, valor estimat, divisa, data de compra, quantitat, ubicació física a l'expositor, notes i condició.",
      status: 'ready',
      tags: ['Edició', 'Formulari', 'Col·leccionista', 'Persistència']
    },
    {
      title: "Afegir Múltiples Fotos Pròpies a la Figura",
      description: "El propietari pot afegir tantes fotos noves com vulgui des del botó '+ Foto' de la tira de miniatures, des del botó 'Afegir fotos' del panell o mitjançant enllaç URL. Les fotos es comprimeixen automàticament i es desen tant al servidor com a la memòria local.",
      status: 'ready',
      tags: ['Múltiples Fotos', 'Càmera', 'Galeria', 'Pujar Imatges']
    },
    {
      title: "Canviar la Foto de Portada i Gestionar Galeria",
      description: "Selecciona qualsevol de les fotos de la galeria i prem 'Definir com a foto de portada' per convertir-la en la imatge principal del teu cardback. També pots eliminar fotos secundàries que hagis afegit prèviament.",
      status: 'ready',
      tags: ['Portada', 'Galeria', 'Personalització']
    },
    {
      title: "Visor de Càmera en Directe d'estil Google Lens (IA)",
      description: "Obre 'Google Lens (IA)' des del menú lateral, el tauler o la barra mòbil. Fes clic a 'Obrir Càmera en Directe' per veure el vídeo a temps real amb retícula d'enfocament i làser animat. Pots girar la càmera i prémer l'obturador per capturar i identificar.",
      status: 'ready',
      tags: ['Google Lens', 'Càmera Directa', 'Visor en Temps Real', 'Mòbil']
    },
    {
      title: "Botó 'Neteja' per reiniciar sessions sense canviar de pàgina",
      description: "A la pantalla de Google Lens, el botó 'Neteja' atura la càmera, esborra la foto i els resultats i buida el selector de fitxers per començar una sessió neta a l'instant.",
      status: 'ready',
      tags: ['Neteja', 'Reset', 'UX', 'Sessió']
    }
  ],
  changelog: [
    {
      version: 'v2.7.0',
      date: '2026-10-23',
      title: "Navegació a detall post-afegit, panell d'inventari de propietari, edició completa i càrrega de fotos",
      highlights: [
        "Un cop afegida qualsevol figura a la col·lecció, l'app navega de manera fluida directament a la seva pàgina de detall (/detail/figure/:id).",
        "Detecció automàtica de propietat de la figura a FigureDetail amb sincronització reactiva a temps real via CollectionService.subscribe.",
        "Nou panell de propietari d'estil cardback que desglossa preu de compra, valor estimat, càlcul de revalorització, estat, ubicació i comentaris personals.",
        "Formulari complet d'edició disponible directament des de la fitxa per ajustar tots els paràmetres de la figura.",
        "Gestió avançada de múltiples fotos: càrrega directa des de fitxers/càmera amb compressió, afegir per URL, selector de foto de portada i eliminació de fotos pròpies."
      ]
    },
    {
      version: 'v2.6.0',
      date: '2026-10-22',
      title: "Restauració completa de càmera Google Lens, botó 'Neteja' i models de visió Gemini",
      highlights: [
        "Restablert el visor de càmera interactiu en directe amb streaming WebRTC/getUserMedia, cantoneres fluorescents i animació de làser d'escaneig.",
        "Afegit i habilitat el botó 'Neteja' a la capçalera, panell d'accions i fitxa de resultats per reiniciar la sessió d'identificació sense haver de canviar de pàgina.",
        "Corregida la configuració de models de visió Gemini al backend per a una identificació instantània i ultra fiable."
      ]
    }
  ]
};
