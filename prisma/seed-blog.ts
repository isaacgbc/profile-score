/**
 * One-time seed script: migrates hardcoded blog posts to the database.
 * Run: npx tsx prisma/seed-blog.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ─── Post 1: ATS Systems ─── */
const atsContentEn = `
<h2>What Is an ATS?</h2>
<p>An Applicant Tracking System (ATS) is software that employers use to manage and filter job applications. Before a recruiter or hiring manager reads your resume, the ATS scans it for relevant keywords, formatting compatibility, and other criteria set by the employer.</p>
<p>Studies show that up to <strong>75% of resumes are rejected by ATS</strong> before a human ever sees them. Understanding how these systems work is the first step toward getting past them.</p>

<h2>How ATS Scanning Works</h2>
<p>When you submit a resume, the ATS performs several key operations:</p>
<ul>
<li><strong>Parsing:</strong> The system extracts text from your document, breaking it into sections like contact information, work experience, education, and skills.</li>
<li><strong>Keyword Matching:</strong> It compares the extracted text against the job description, looking for specific skills, job titles, and qualifications.</li>
<li><strong>Ranking:</strong> Each resume receives a score based on how well it matches the requirements. Only top-scoring resumes move forward.</li>
</ul>

<h2>Common Reasons for ATS Rejection</h2>
<p>Your resume might be filtered out for several reasons:</p>
<ul>
<li><strong>Wrong file format:</strong> Some systems struggle with PDFs that use complex layouts. Stick to clean formatting.</li>
<li><strong>Missing keywords:</strong> If the job description asks for "project management" and you only list "managed projects," the ATS may not make the connection.</li>
<li><strong>Complex layouts:</strong> Tables, columns, headers/footers, and text boxes can confuse ATS parsers.</li>
<li><strong>Graphics and images:</strong> ATS cannot read text embedded in images, logos, or icons.</li>
</ul>

<h2>How to Optimize for ATS</h2>
<p>Follow these strategies to improve your chances:</p>
<ol>
<li><strong>Mirror the job description:</strong> Use the exact keywords and phrases from the posting. If they say "data analysis," use "data analysis" — not just "analytics."</li>
<li><strong>Use standard section headings:</strong> Stick to "Work Experience," "Education," "Skills," and "Summary" rather than creative alternatives.</li>
<li><strong>Keep formatting simple:</strong> Use a single-column layout, standard fonts, and avoid tables or graphics.</li>
<li><strong>Include both acronyms and full terms:</strong> Write "Search Engine Optimization (SEO)" so the ATS catches both versions.</li>
<li><strong>Tailor every application:</strong> Customize your resume for each position rather than sending the same generic version.</li>
</ol>

<h2>Where Profile Score Helps</h2>
<p>Profile Score's AI-powered audit analyzes your resume against ATS best practices, identifies missing keywords, and suggests improvements — all in seconds. Our rewrite studio then helps you implement changes with AI-guided suggestions tailored to your target role.</p>
`;

const atsContentEs = `
<h2>¿Qué es un ATS?</h2>
<p>Un Sistema de Seguimiento de Candidatos (ATS) es un software que los empleadores usan para gestionar y filtrar solicitudes de empleo. Antes de que un reclutador o gerente de contratación lea tu CV, el ATS lo escanea buscando palabras clave relevantes, compatibilidad de formato y otros criterios definidos por el empleador.</p>
<p>Los estudios muestran que hasta un <strong>75% de los CVs son rechazados por el ATS</strong> antes de que un humano los vea. Entender cómo funcionan estos sistemas es el primer paso para superarlos.</p>

<h2>Cómo Funciona el Escaneo ATS</h2>
<p>Cuando envías un CV, el ATS realiza varias operaciones clave:</p>
<ul>
<li><strong>Análisis:</strong> El sistema extrae texto de tu documento, dividiéndolo en secciones como información de contacto, experiencia laboral, educación y habilidades.</li>
<li><strong>Coincidencia de palabras clave:</strong> Compara el texto extraído con la descripción del puesto, buscando habilidades específicas, títulos de trabajo y calificaciones.</li>
<li><strong>Clasificación:</strong> Cada CV recibe una puntuación basada en qué tan bien coincide con los requisitos. Solo los CVs con mejor puntuación avanzan.</li>
</ul>

<h2>Razones Comunes de Rechazo ATS</h2>
<p>Tu CV podría ser filtrado por varias razones:</p>
<ul>
<li><strong>Formato de archivo incorrecto:</strong> Algunos sistemas tienen problemas con PDFs que usan diseños complejos. Mantén un formato limpio.</li>
<li><strong>Palabras clave faltantes:</strong> Si la descripción del puesto pide "gestión de proyectos" y solo listas "gestioné proyectos," el ATS puede no hacer la conexión.</li>
<li><strong>Diseños complejos:</strong> Tablas, columnas, encabezados/pies de página y cuadros de texto pueden confundir a los analizadores ATS.</li>
<li><strong>Gráficos e imágenes:</strong> El ATS no puede leer texto incrustado en imágenes, logos o íconos.</li>
</ul>

<h2>Cómo Optimizar para ATS</h2>
<p>Sigue estas estrategias para mejorar tus posibilidades:</p>
<ol>
<li><strong>Refleja la descripción del puesto:</strong> Usa las palabras clave y frases exactas de la publicación.</li>
<li><strong>Usa encabezados estándar:</strong> Usa "Experiencia Laboral," "Educación," "Habilidades" y "Resumen" en lugar de alternativas creativas.</li>
<li><strong>Mantén el formato simple:</strong> Usa un diseño de una sola columna, fuentes estándar y evita tablas o gráficos.</li>
<li><strong>Incluye tanto siglas como términos completos:</strong> Escribe "Optimización de Motores de Búsqueda (SEO)" para que el ATS capture ambas versiones.</li>
<li><strong>Personaliza cada solicitud:</strong> Adapta tu CV para cada posición en lugar de enviar la misma versión genérica.</li>
</ol>

<h2>Dónde Ayuda Profile Score</h2>
<p>La auditoría impulsada por IA de Profile Score analiza tu CV contra las mejores prácticas de ATS, identifica palabras clave faltantes y sugiere mejoras — todo en segundos. Nuestro estudio de reescritura te ayuda a implementar cambios con sugerencias guiadas por IA adaptadas a tu rol objetivo.</p>
`;

/* ─── Post 2: LinkedIn Optimization ─── */
const linkedinContentEn = `
<h2>Why LinkedIn Optimization Matters</h2>
<p>LinkedIn is the world's largest professional network with over 900 million members. Recruiters use it daily to find candidates, making your profile essentially a living, searchable resume. A well-optimized profile can generate inbound opportunities without you actively applying to jobs.</p>
<p>Research shows that profiles with professional photos receive <strong>14x more views</strong>, and those with complete information are <strong>40x more likely</strong> to receive opportunities through LinkedIn.</p>

<h2>The Headline: Your Digital First Impression</h2>
<p>Your headline is the most visible element after your name. It appears in search results, connection requests, and comments. Instead of just listing your job title, use a value-driven headline:</p>
<ul>
<li><strong>Weak:</strong> "Software Engineer at TechCorp"</li>
<li><strong>Strong:</strong> "Software Engineer | Building Scalable SaaS Products | React · Node.js · AWS"</li>
</ul>
<p>Include keywords recruiters search for, your specialty, and the technologies or skills that define your expertise.</p>

<h2>The About Section: Tell Your Story</h2>
<p>Think of your About section as a professional elevator pitch. Structure it as follows:</p>
<ol>
<li><strong>Hook:</strong> Start with a compelling statement about what drives you or what you achieve.</li>
<li><strong>Value proposition:</strong> What do you do and who do you help?</li>
<li><strong>Key achievements:</strong> 2-3 quantified accomplishments.</li>
<li><strong>Call to action:</strong> How should people reach you?</li>
</ol>

<h2>Experience Section: Quantify Everything</h2>
<p>Each role should follow the <strong>CAR formula</strong>: Challenge, Action, Result.</p>
<ul>
<li>Instead of: "Managed marketing campaigns"</li>
<li>Write: "Led a team of 5 to redesign the email marketing strategy, increasing open rates by 34% and driving $2.1M in pipeline revenue within 6 months"</li>
</ul>
<p>Numbers and metrics make your achievements concrete and memorable.</p>

<h2>Skills & Endorsements</h2>
<p>LinkedIn allows up to 50 skills. Prioritize your top skills by:</p>
<ul>
<li>Listing the most relevant skills for your target role first</li>
<li>Including a mix of hard skills (Python, Financial Modeling) and soft skills (Leadership, Cross-functional Collaboration)</li>
<li>Requesting endorsements from colleagues who can vouch for specific skills</li>
</ul>

<h2>How Profile Score Optimizes Your LinkedIn</h2>
<p>Profile Score analyzes your LinkedIn profile against industry benchmarks, identifies gaps in keywords and structure, and generates AI-powered rewrites for every section — headline, about, experience, and more. Get a detailed score with actionable recommendations in under 60 seconds.</p>
`;

const linkedinContentEs = `
<h2>Por Qué Importa la Optimización de LinkedIn</h2>
<p>LinkedIn es la red profesional más grande del mundo con más de 900 millones de miembros. Los reclutadores la usan diariamente para encontrar candidatos, haciendo de tu perfil esencialmente un CV viviente y buscable. Un perfil bien optimizado puede generar oportunidades entrantes sin que solicites activamente empleos.</p>
<p>Las investigaciones muestran que los perfiles con fotos profesionales reciben <strong>14 veces más vistas</strong>, y aquellos con información completa tienen <strong>40 veces más probabilidades</strong> de recibir oportunidades a través de LinkedIn.</p>

<h2>El Titular: Tu Primera Impresión Digital</h2>
<p>Tu titular es el elemento más visible después de tu nombre. Aparece en resultados de búsqueda, solicitudes de conexión y comentarios. En lugar de solo listar tu título de trabajo, usa un titular orientado al valor:</p>
<ul>
<li><strong>Débil:</strong> "Ingeniero de Software en TechCorp"</li>
<li><strong>Fuerte:</strong> "Ingeniero de Software | Construyendo Productos SaaS Escalables | React · Node.js · AWS"</li>
</ul>
<p>Incluye palabras clave que los reclutadores buscan, tu especialidad y las tecnologías o habilidades que definen tu experiencia.</p>

<h2>La Sección Acerca de: Cuenta Tu Historia</h2>
<p>Piensa en tu sección Acerca de como un elevator pitch profesional. Estructúralo así:</p>
<ol>
<li><strong>Gancho:</strong> Comienza con una declaración convincente sobre lo que te impulsa o lo que logras.</li>
<li><strong>Propuesta de valor:</strong> ¿Qué haces y a quién ayudas?</li>
<li><strong>Logros clave:</strong> 2-3 logros cuantificados.</li>
<li><strong>Llamada a la acción:</strong> ¿Cómo deben contactarte?</li>
</ol>

<h2>Sección de Experiencia: Cuantifica Todo</h2>
<p>Cada rol debe seguir la <strong>fórmula CAR</strong>: Desafío, Acción, Resultado.</p>
<ul>
<li>En lugar de: "Gestioné campañas de marketing"</li>
<li>Escribe: "Lideré un equipo de 5 para rediseñar la estrategia de email marketing, aumentando las tasas de apertura un 34% y generando $2.1M en ingresos de pipeline en 6 meses"</li>
</ul>
<p>Los números y métricas hacen que tus logros sean concretos y memorables.</p>

<h2>Habilidades y Validaciones</h2>
<p>LinkedIn permite hasta 50 habilidades. Prioriza tus habilidades principales:</p>
<ul>
<li>Lista primero las habilidades más relevantes para tu rol objetivo</li>
<li>Incluye una mezcla de habilidades técnicas (Python, Modelado Financiero) y habilidades blandas (Liderazgo, Colaboración Cross-funcional)</li>
<li>Solicita validaciones de colegas que puedan dar fe de habilidades específicas</li>
</ul>

<h2>Cómo Profile Score Optimiza Tu LinkedIn</h2>
<p>Profile Score analiza tu perfil de LinkedIn contra benchmarks de la industria, identifica brechas en palabras clave y estructura, y genera reescrituras impulsadas por IA para cada sección — titular, acerca de, experiencia y más. Obtén una puntuación detallada con recomendaciones accionables en menos de 60 segundos.</p>
`;

/* ─── Post 3: CV vs Resume ─── */
const cvResumeContentEn = `
<h2>The Basic Difference</h2>
<p>While many people use "CV" and "resume" interchangeably, they serve different purposes depending on your region and industry:</p>
<ul>
<li>A <strong>resume</strong> is a concise 1-2 page document tailored to a specific job. It highlights relevant experience and skills.</li>
<li>A <strong>CV (Curriculum Vitae)</strong> is a comprehensive document covering your entire academic and professional history. It can be several pages long.</li>
</ul>

<h2>When to Use a Resume</h2>
<p>In the United States and Canada, a resume is the standard for most industries:</p>
<ul>
<li><strong>Corporate roles:</strong> Marketing, finance, engineering, product management</li>
<li><strong>Tech industry:</strong> Software engineering, data science, UX design</li>
<li><strong>Startup and SMB positions:</strong> Where brevity is valued</li>
</ul>
<p>Resumes should be targeted — each application should have a customized version emphasizing the most relevant experience for that specific role.</p>

<h2>When to Use a CV</h2>
<p>CVs are preferred or required in several contexts:</p>
<ul>
<li><strong>Academic positions:</strong> Professorships, research roles, postdoctoral positions</li>
<li><strong>European and Latin American markets:</strong> Many countries expect a CV as the standard application document</li>
<li><strong>Medical and scientific fields:</strong> Where publications, grants, and research experience matter</li>
<li><strong>International applications:</strong> When applying to organizations outside the US/Canada</li>
</ul>

<h2>Key Structural Differences</h2>
<table>
<tr><th>Feature</th><th>Resume</th><th>CV</th></tr>
<tr><td>Length</td><td>1-2 pages</td><td>2+ pages (no limit)</td></tr>
<tr><td>Focus</td><td>Relevant experience</td><td>Complete history</td></tr>
<tr><td>Customization</td><td>Tailored per job</td><td>Mostly static</td></tr>
<tr><td>Sections</td><td>Summary, Experience, Skills, Education</td><td>All of the above plus Publications, Conferences, Grants, Research</td></tr>
</table>

<h2>Tips for Optimizing Both</h2>
<ol>
<li><strong>Start with a strong summary:</strong> Whether CV or resume, your opening paragraph should clearly communicate your value.</li>
<li><strong>Use keywords strategically:</strong> Both documents benefit from including industry-specific terminology that ATS and recruiters look for.</li>
<li><strong>Quantify achievements:</strong> Numbers speak louder than descriptions. Use metrics wherever possible.</li>
<li><strong>Keep formatting clean:</strong> Use consistent fonts, clear headings, and plenty of white space.</li>
<li><strong>Update regularly:</strong> Don't wait until you need to apply. Keep both documents current with recent achievements.</li>
</ol>

<h2>Profile Score Works for Both</h2>
<p>Whether you're optimizing a one-page resume for a US tech role or a multi-page CV for an academic position in Europe, Profile Score's AI audit adapts to your document type and target market. Upload your document, specify your target role, and get instant, actionable feedback.</p>
`;

const cvResumeContentEs = `
<h2>La Diferencia Básica</h2>
<p>Aunque muchas personas usan "CV" y "currículum" de manera intercambiable, sirven para propósitos diferentes dependiendo de tu región e industria:</p>
<ul>
<li>Un <strong>currículum (resume)</strong> es un documento conciso de 1-2 páginas adaptado a un trabajo específico. Destaca experiencia y habilidades relevantes.</li>
<li>Un <strong>CV (Curriculum Vitae)</strong> es un documento completo que cubre toda tu historia académica y profesional. Puede tener varias páginas.</li>
</ul>

<h2>Cuándo Usar un Currículum</h2>
<p>En Estados Unidos y Canadá, el currículum es el estándar para la mayoría de las industrias:</p>
<ul>
<li><strong>Roles corporativos:</strong> Marketing, finanzas, ingeniería, gestión de productos</li>
<li><strong>Industria tech:</strong> Ingeniería de software, ciencia de datos, diseño UX</li>
<li><strong>Posiciones en startups y PYMES:</strong> Donde se valora la brevedad</li>
</ul>
<p>Los currículums deben ser específicos — cada solicitud debe tener una versión personalizada que enfatice la experiencia más relevante para ese rol específico.</p>

<h2>Cuándo Usar un CV</h2>
<p>Los CVs son preferidos o requeridos en varios contextos:</p>
<ul>
<li><strong>Posiciones académicas:</strong> Profesorados, roles de investigación, posiciones postdoctorales</li>
<li><strong>Mercados europeos y latinoamericanos:</strong> Muchos países esperan un CV como el documento estándar de solicitud</li>
<li><strong>Campos médicos y científicos:</strong> Donde las publicaciones, becas y experiencia en investigación importan</li>
<li><strong>Solicitudes internacionales:</strong> Al postular a organizaciones fuera de EE.UU./Canadá</li>
</ul>

<h2>Diferencias Estructurales Clave</h2>
<table>
<tr><th>Característica</th><th>Currículum</th><th>CV</th></tr>
<tr><td>Longitud</td><td>1-2 páginas</td><td>2+ páginas (sin límite)</td></tr>
<tr><td>Enfoque</td><td>Experiencia relevante</td><td>Historia completa</td></tr>
<tr><td>Personalización</td><td>Adaptado por trabajo</td><td>Mayormente estático</td></tr>
<tr><td>Secciones</td><td>Resumen, Experiencia, Habilidades, Educación</td><td>Todo lo anterior más Publicaciones, Conferencias, Becas, Investigación</td></tr>
</table>

<h2>Consejos para Optimizar Ambos</h2>
<ol>
<li><strong>Comienza con un resumen fuerte:</strong> Ya sea CV o currículum, tu párrafo inicial debe comunicar claramente tu valor.</li>
<li><strong>Usa palabras clave estratégicamente:</strong> Ambos documentos se benefician de incluir terminología específica de la industria que los ATS y reclutadores buscan.</li>
<li><strong>Cuantifica logros:</strong> Los números hablan más fuerte que las descripciones. Usa métricas donde sea posible.</li>
<li><strong>Mantén el formato limpio:</strong> Usa fuentes consistentes, encabezados claros y suficiente espacio en blanco.</li>
<li><strong>Actualiza regularmente:</strong> No esperes hasta que necesites postular. Mantén ambos documentos actualizados con logros recientes.</li>
</ol>

<h2>Profile Score Funciona para Ambos</h2>
<p>Ya sea que estés optimizando un currículum de una página para un rol tech en EE.UU. o un CV de varias páginas para una posición académica en Europa, la auditoría de IA de Profile Score se adapta a tu tipo de documento y mercado objetivo. Sube tu documento, especifica tu rol objetivo y obtén retroalimentación instantánea y accionable.</p>
`;

const posts = [
  {
    slug: "how-ats-systems-work",
    title: "How ATS Systems Work and Why Your Resume Gets Rejected",
    titleEs: "Cómo Funcionan los Sistemas ATS y Por Qué Tu CV Es Rechazado",
    description: "Learn how Applicant Tracking Systems filter resumes before a human ever sees them, and discover what you can do to pass the automated screening.",
    descriptionEs: "Aprende cómo los sistemas de seguimiento de candidatos filtran CVs antes de que un humano los vea, y descubre qué puedes hacer para pasar el filtro automático.",
    content: atsContentEn.trim(),
    contentEs: atsContentEs.trim(),
    author: "Profile Score Team",
    tags: ["ats", "resume", "career"],
    readingTimeMin: 6,
    published: true,
    publishedAt: new Date("2025-01-15"),
  },
  {
    slug: "linkedin-profile-optimization-guide",
    title: "LinkedIn Profile Optimization: A Complete Guide",
    titleEs: "Optimización de Perfil de LinkedIn: Guía Completa",
    description: "Discover the exact strategies that top professionals use to optimize their LinkedIn profiles for maximum visibility and recruiter engagement.",
    descriptionEs: "Descubre las estrategias exactas que los profesionales top usan para optimizar sus perfiles de LinkedIn para máxima visibilidad y engagement con reclutadores.",
    content: linkedinContentEn.trim(),
    contentEs: linkedinContentEs.trim(),
    author: "Profile Score Team",
    tags: ["linkedin", "optimization", "career"],
    readingTimeMin: 8,
    published: true,
    publishedAt: new Date("2025-01-20"),
  },
  {
    slug: "cv-vs-resume-which-one",
    title: "CV vs Resume: Which One Do You Need?",
    titleEs: "CV vs Currículum: ¿Cuál Necesitas?",
    description: "Understand the key differences between a CV and a resume, when to use each one, and how to optimize both for your target market.",
    descriptionEs: "Entiende las diferencias clave entre un CV y un currículum, cuándo usar cada uno, y cómo optimizar ambos para tu mercado objetivo.",
    content: cvResumeContentEn.trim(),
    contentEs: cvResumeContentEs.trim(),
    author: "Profile Score Team",
    tags: ["cv", "resume", "career"],
    readingTimeMin: 5,
    published: true,
    publishedAt: new Date("2025-02-01"),
  },
];

async function main() {
  for (const post of posts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: post,
      create: post,
    });
    console.log(`✓ Seeded: ${post.slug}`);
  }
  console.log("Blog seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
