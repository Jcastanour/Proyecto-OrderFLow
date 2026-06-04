# Prompt para Gemini — Generación de 20 imágenes de comida colombiana

## Instrucción para la IA

Vas a generar **20 imágenes fotorrealistas de comida colombiana** para el catálogo de un restaurante digital (app OrderFlow). Itera una por una y guárdalas todas en una carpeta llamada `comidas-colombianas/` con el nombre de archivo exacto que se indica en cada ítem.

### Estilo visual (aplica a TODAS las imágenes)

- **Formato:** cuadrado 1024×1024 px, JPG o PNG.
- **Estilo:** fotografía gastronómica profesional, top-down (cenital) o ángulo 45°, luz natural cálida y suave, fondo de madera rústica oscura o mantel artesanal colombiano (con sutiles motivos típicos, sin sobrecargar).
- **Composición:** plato centrado, ocupando ~70% del encuadre, con bokeh ligero en el fondo. Pequeños props auténticos (una arepa al lado, hojas de plátano, granos de café, totumas, cuchara de madera) cuando aporten contexto.
- **Color:** saturación rica pero realista, alta nitidez, sombras suaves. Evitar filtros artificiales o estética "AI genérica".
- **Sin texto, sin marcas de agua, sin manos humanas, sin utensilios modernos plásticos.**
- **Vajilla:** loza blanca, barro cocido, totuma o plato de madera, según el plato.

### Lista de 20 platos a generar

| # | Nombre del plato | Nombre de archivo | Descripción para el prompt |
|---|---|---|---|
| 1 | Ajiaco Santafereño | `ajiaco-santafereno.jpg` | Sopa cremosa bogotana con tres papas (criolla amarilla deshecha), pollo deshebrado, mazorca tierna, alcaparras y crema de leche aparte. Servir en plato hondo de loza blanca con aguacate y arroz al lado. |
| 2 | Sancocho Trifásico | `sancocho-trifasico.jpg` | Sopa contundente con presa de pollo, carne de res y costilla de cerdo, plátano verde, yuca, mazorca y cilantro. Servir en olla de barro o plato hondo grande con arroz y aguacate al lado. |
| 3 | Lechona Tolimense | `lechona-tolimense.jpg` | Cerdo entero relleno de arroz amarillo, arvejas y especias, con piel dorada y crujiente. Porción servida sobre arepa blanca redonda, espolvoreada con cebolla larga. |
| 4 | Hamburguesa Criolla | `hamburguesa-criolla.jpg` | Hamburguesa colombiana al estilo callejero: carne de res, queso fundido, lechuga, tomate, papas trituradas (papa ripio), salsas rosadas y piña. Pan brioche dorado, presentada con papas a la francesa al lado. |
| 5 | Perro Caliente Colombiano | `perro-caliente-colombiano.jpg` | Hot dog estilo colombiano con salchicha, queso rallado fundido, papas trituradas, tocineta, salsa rosada, mayonesa, mostaza y piña en cubitos. Pan alargado suave. |
| 6 | Picada Antioqueña | `picada-antioquena.jpg` | Tabla grande de madera con chicharrón, chorizo, morcilla, carne asada en trozos, papa criolla frita, plátano maduro, arepa pequeña y aguacate. Estilo abundante, para compartir. |
| 7 | Chorizo con Arepa | `chorizo-con-arepa.jpg` | Dos chorizos santarrosanos dorados con costras crocantes, acompañados de arepa blanca asada y limón en mitades. Plato sencillo de loza. |
| 8 | Yuca Frita | `yuca-frita.jpg` | Bastones gruesos de yuca dorados y crujientes por fuera, blancos por dentro, servidos en cesta con papel encerado y salsa rosada o suero costeño en cuenco aparte. |
| 9 | Patacones con Hogao | `patacones-con-hogao.jpg` | Cuatro patacones grandes y dorados de plátano verde, coronados con hogao (sofrito de tomate y cebolla larga). Servidos sobre hoja de plátano o tabla de madera. |
| 10 | Lulada Caleña | `lulada-calena.jpg` | Bebida caleña en vaso de vidrio alto, color amarillo verdoso, con trozos visibles de lulo macerado, hielo picado y una rodaja de limón en el borde. Fondo tropical. |
| 11 | Limonada de Coco | `limonada-de-coco.jpg` | Bebida cremosa color blanco amarillento en vaso alto, con espuma encima, ralladura de coco fresco, una rodaja de limón y pitillo de bambú. Frescura tropical. |
| 12 | Aguapanela con Queso | `aguapanela-con-queso.jpg` | Taza de barro humeante con aguapanela caliente color ámbar, junto a un trozo de queso campesino blanco en plato pequeño. Ambiente acogedor de páramo. |
| 13 | Chicha de Maíz | `chicha-de-maiz.jpg` | Bebida fermentada de maíz en totuma o vaso de barro tradicional, color amarillo opaco, espuma ligera. Acompañada de granos de maíz secos y una hoja verde decorativa. |
| 14 | Obleas con Arequipe | `obleas-con-arequipe.jpg` | Dos obleas redondas crujientes rellenas de arequipe (dulce de leche) abundante que escurre por los bordes, espolvoreadas con queso rallado fresco y coco rallado. |
| 15 | Brevas con Arequipe | `brevas-con-arequipe.jpg` | Tres brevas en almíbar oscuras, abiertas por la mitad y rellenas con arequipe espeso. Servidas en plato de loza con cuchara de plata. |
| 16 | Tres Leches | `tres-leches.jpg` | Porción cuadrada de torta esponjosa empapada en leche, cubierta con merengue blanco esponjoso y una cereza roja encima. Plato blanco minimalista. |
| 17 | Calentado Paisa | `calentado-paisa.jpg` | Desayuno paisa con arroz y frijoles recalentados mezclados, huevo frito encima, chicharrón, arepa redonda, tajada de plátano maduro y hogao. Plato grande de loza. |
| 18 | Changua Bogotana | `changua-bogotana.jpg` | Sopa bogotana de leche con huevo escalfado entero visible, cebolla larga picada, cilantro y trozos de pan calao (almojábana o pan blanco). Servida en plato hondo. |
| 19 | Caldo de Costilla | `caldo-de-costilla.jpg` | Caldo claro con costilla de res grande, papa pastusa entera, cilantro fresco abundante. Acompañado de arepa blanca y chocolate caliente al lado. |
| 20 | Tamal Tolimense | `tamal-tolimense.jpg` | Tamal grande envuelto en hoja de plátano, parcialmente abierto mostrando masa amarilla con presa de pollo, costilla de cerdo, garbanzos, zanahoria y huevo duro. Acompañado de chocolate caliente y pan. |

### Reglas finales para la generación

1. **Itera una por una**, no las generes en lote para mantener consistencia de calidad.
2. **Usa exactamente el nombre de archivo indicado** (kebab-case, sin tildes, sin eñes — `ñ` → `n`).
3. **Guarda todas en una sola carpeta** llamada `comidas-colombianas/`.
4. Al terminar, **comprime la carpeta en un .zip** y entrégamela.
5. Si una imagen no cumple el estilo (ej: parece dibujo animado o tiene texto), regenérala antes de pasar a la siguiente.

---

**Resumen de entrega esperada:** carpeta `comidas-colombianas/` con 20 archivos `.jpg` nombrados como en la tabla.
