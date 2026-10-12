/** Frases locales para el modo minimalista. Sin API, sin red. */
export const QUOTES = [
  { text: 'La simplicidad es la máxima sofisticación.', author: 'Leonardo da Vinci' },
  { text: 'Lo que se hace por amor está siempre más allá del bien y del mal.', author: 'Friedrich Nietzsche' },
  { text: 'No basta con dar pasos que un día puedan conducir hasta la meta, sino que cada paso ha de ser una meta.', author: 'Johann W. Goethe' },
  { text: 'El secreto de salir adelante es empezar.', author: 'Mark Twain' },
  { text: 'Caminante, no hay camino, se hace camino al andar.', author: 'Antonio Machado' },
  { text: 'La disciplina es el puente entre las metas y los logros.', author: 'Jim Rohn' },
  { text: 'Nada tiene tanto poder para ampliar la mente como la capacidad de investigar.', author: 'Marco Aurelio' },
  { text: 'Hazlo simple, pero significativo.', author: 'Don Draper' },
  { text: 'El tiempo es lo que más queremos y lo que peor usamos.', author: 'William Penn' },
  { text: 'La perfección se alcanza no cuando no hay nada más que añadir, sino cuando no hay nada más que quitar.', author: 'Antoine de Saint-Exupéry' },
  { text: 'Un objetivo sin un plan es solo un deseo.', author: 'Antoine de Saint-Exupéry' },
  { text: 'La mejor forma de predecir el futuro es inventarlo.', author: 'Alan Kay' },
  { text: 'No cuentes los días, haz que los días cuenten.', author: 'Muhammad Ali' },
  { text: 'Aquello a lo que resistes, persiste.', author: 'Carl Jung' },
  { text: 'Quien tiene un porqué para vivir puede soportar casi cualquier cómo.', author: 'Viktor Frankl' },
  { text: 'La calma es la cuna del poder.', author: 'Josiah Gilbert Holland' },
  { text: 'Empieza donde estás. Usa lo que tienes. Haz lo que puedas.', author: 'Arthur Ashe' },
  { text: 'Todo lo que somos es el resultado de lo que hemos pensado.', author: 'Buda' },
  { text: 'La atención es la forma más rara y pura de generosidad.', author: 'Simone Weil' },
  { text: 'El orden y la simplificación son los primeros pasos hacia el dominio de un tema.', author: 'Thomas Mann' },
  { text: 'Nunca es tarde para ser lo que podrías haber sido.', author: 'George Eliot' },
  { text: 'La acción es la clave fundamental de todo éxito.', author: 'Pablo Picasso' },
  { text: 'Piensa despacio, actúa rápido.', author: 'Proverbio' },
  { text: 'Lo urgente rara vez es importante y lo importante rara vez es urgente.', author: 'Dwight D. Eisenhower' },
  { text: 'Sé implacable con el tiempo y amable con las personas.', author: 'Proverbio' },
  { text: 'Un poco cada día suma más que mucho de vez en cuando.', author: 'Proverbio' },
  { text: 'La libertad no es hacer lo que quieras, sino querer lo que haces.', author: 'Jean-Paul Sartre' },
  { text: 'El que tiene salud tiene esperanza, y el que tiene esperanza lo tiene todo.', author: 'Proverbio árabe' },
  { text: 'La creatividad es la inteligencia divirtiéndose.', author: 'Albert Einstein' },
  { text: 'Haz de cada día tu obra maestra.', author: 'John Wooden' },
  { text: 'La paciencia es amarga, pero su fruto es dulce.', author: 'Jean-Jacques Rousseau' },
];

/** Frase determinista del día: la misma durante toda la jornada. */
export function quoteOfTheDay(date = new Date(), list = QUOTES) {
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000,
  );
  const index = ((day % list.length) + list.length) % list.length;
  return list[index];
}
