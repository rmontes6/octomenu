const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Tu catálogo de platos",
    body: (
      <>
        <p>
          Cada plato que das de alta en <strong>Platos</strong> lleva una categoría (plato único, primer plato,
          segundo plato o guarnición), si es para comida, cena o ambas, y una lista de ingredientes con cantidad y
          unidad — de ahí sale luego la lista de la compra.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Temporada</strong>: si un plato solo tiene sentido en una época del año (un gazpacho, un
            cocido), márcalo como verano (mayo a septiembre) o invierno (octubre a abril). El generador nunca lo
            usará fuera de esa mitad del año; si lo dejas en &ldquo;todo el año&rdquo; (el valor por defecto), no
            se filtra nunca.
          </li>
          <li>
            <strong>Grupo</strong> (carne, pescado, verdura, pasta o arroz, legumbre, huevo u otro): ayuda al
            generador a repartir la semana — cada primero/segundo/plato único que elige cuenta para no repetir el
            mismo grupo mientras haya alternativa de otro grupo disponible ese día. Las guarniciones no cuentan
            para este reparto.
          </li>
          <li>
            <strong>Rinde para 2 tomas</strong>: si lo marcas, ese plato se repite automáticamente al día siguiente
            en la misma franja (comida→comida, cena→cena) sin volver a sortearlo, y solo un día más (no se
            propaga una tercera vez).
          </li>
          <li>
            <strong>Lleva guarnición</strong> (solo en segundos platos): si lo desmarcas, ese segundo nunca se
            acompaña de guarnición. Esto no cambia lo demás: todo segundo, lleve o no guarnición, sale siempre
            acompañado de un primero — nunca solo en el hueco.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Cómo se genera el menú semanal",
    body: (
      <>
        <p>Para cada comida y cena de la semana, el generador arma uno de estos huecos, según lo que tengas en el catálogo:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Un plato único, o</li>
          <li>
            Primer plato + segundo plato, siempre los dos juntos — un primero o un segundo nunca salen solos. Si
            ese día caben tanto un plato único como esta combinación, se sortea al 50% entre las dos.
          </li>
          <li>
            El hueco se queda vacío si el catálogo no da para ninguna de las dos (p. ej. no queda ningún segundo
            disponible ese día). Un primero que por sí solo ya sea una comida completa (un potaje, unas lentejas)
            debería darse de alta como plato único en vez de como primero.
          </li>
        </ul>
        <p>Dentro de la combinación primero + segundo, la guarnición depende del segundo elegido (ver &ldquo;Lleva guarnición&rdquo; arriba): se añade si el catálogo tiene alguna disponible, y si no, no.</p>
        <p>
          Dentro de una misma semana nunca se repite un plato (salvo la copia automática de &ldquo;rinde 2
          tomas&rdquo;, que es el mismo plato a propósito) — esta es una regla estricta, aunque el catálogo se
          quede corto y algún hueco acabe vacío. También evita, mientras haya alternativa, repetir platos de la
          última semana que generaste (si dejaste una semana entera sin generar, esa comparación no se hace); si
          no hay más remedio, los repite antes que dejar el hueco vacío.
        </p>
      </>
    ),
  },
  {
    title: "Ajustar el menú a mano",
    body: (
      <>
        <p>
          Antes de generar, puedes marcar con 🚫 cualquier comida o cena en la que sepas que vas a comer fuera —
          ese hueco se queda vacío a propósito y no cuenta como &ldquo;sin plato&rdquo;. Se guarda solo, así que
          aunque cambies de pantalla y vuelvas, sigue marcado. Por defecto ya vienen marcados la cena del viernes,
          todo el sábado y todo el domingo, además de los días de esta semana que ya han pasado (hoy nunca se
          marca solo); puedes desmarcar cualquiera de ellos si quieres rellenarlo igualmente.
        </p>
        <p>Una vez generado, con &ldquo;Editar&rdquo; puedes tocar cualquier plato ya puesto:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>🔀 Cambiarlo por otro plato de la misma categoría, sin tocar el resto de la semana.</li>
          <li>↔️ Moverlo a otro día u otra franja (si ese hueco ya está ocupado, se intercambian los dos platos).</li>
          <li>🗑️ Quitarlo del todo.</li>
          <li>+ Añadir plato, en cualquier hueco libre, eligiendo tú directamente qué plato poner.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Lista de la compra",
    body: (
      <>
        <p>
          No se rellena a mano: se calcula sola a partir de los ingredientes de los platos que tengas puestos esa
          semana (las copias de &ldquo;rinde 2 tomas&rdquo; no cuentan dos veces, ya que es comida que ya compraste
          una vez). Los ingredientes se agrupan por nombre y unidad exactos, así que si escribes &ldquo;ud&rdquo;
          en un plato y &ldquo;unidad&rdquo; en otro, te saldrán como dos líneas distintas — usa siempre la misma
          unidad para el mismo tipo de ingrediente y se sumarán bien. Al escribir la unidad de un ingrediente te
          sugerimos algunas habituales (g, kg, ml, l, ud, cucharada, cucharadita, diente, pizca, lata, paquete,
          rama, sobre); no es obligatorio usarlas, pero ayuda a que todo se agrupe. Para ingredientes que compras
          enteros y usas poco a poco (una miel, unas especias), déjalos sin cantidad ni unidad: así aparecen solo
          por su nombre.
        </p>
        <p>Puedes ir marcando lo que ya has comprado; queda guardado aunque cierres la app.</p>
      </>
    ),
  },
  {
    title: "Cuentas",
    body: (
      <p>
        Cada cuenta tiene su propio catálogo de platos y sus propios menús — nada se comparte entre cuentas. Desde{" "}
        <strong>Usuarios</strong> puedes cambiar tu contraseña; si eres administrador, también puedes crear cuentas
        nuevas o resetear la contraseña de otra persona.
      </p>
    ),
  },
];

export default function AyudaPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Ayuda</h1>
      <p className="mt-1 text-sm text-ink-secondary dark:text-ink-dsecondary">
        Cómo funciona OctoMenu, de un vistazo.
      </p>

      <div className="mt-6 space-y-5">
        {SECTIONS.map((section) => (
          <section key={section.title} className="card space-y-2.5 p-5">
            <h2 className="text-base font-semibold">{section.title}</h2>
            <div className="space-y-2.5 text-sm text-ink-secondary dark:text-ink-dsecondary">{section.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
