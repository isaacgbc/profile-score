export interface BlogPost {
  slug: string;
  title: string;
  titleEs: string;
  description: string;
  descriptionEs: string;
  content: string;
  contentEs: string;
  author: string;
  publishedAt: string;
  updatedAt: string;
  tags: string[];
  readingTimeMin: number;
}

const posts: BlogPost[] = [
  {
    slug: "how-ats-systems-work",
    title: "How ATS Systems Work and Why Your Resume Gets Rejected",
    titleEs: "Cómo Funcionan los Sistemas ATS y Por Qué Tu CV Es Rechazado",
    description:
      "Learn how Applicant Tracking Systems filter resumes before a human ever sees them, and discover what you can do to pass the automated screening.",
    descriptionEs:
      "Aprende cómo los sistemas de seguimiento de candidatos filtran CVs antes de que un humano los vea, y descubre qué puedes hacer para pasar el filtro automático.",
    content: `<h2>What Is an ATS?</h2>
<p>An Applicant Tracking System (ATS) is software used by employers to collect, sort, scan, and rank job applications. Over 98% of Fortune 500 companies use some form of ATS, and an estimated 75% of resumes are rejected by these systems before reaching a human recruiter.</p>

<h2>How ATS Screening Works</h2>
<p>When you submit your resume online, it doesn't go directly to a recruiter's desk. Instead, the ATS parses your document into structured data — extracting your name, contact info, work history, education, and skills. It then compares this parsed data against the job requirements.</p>
<p>The system looks for keyword matches, relevant experience duration, education requirements, and other criteria the employer has configured. Resumes that don't meet the minimum threshold are automatically filtered out.</p>

<h3>Common Reasons Resumes Get Rejected</h3>
<ul>
<li><strong>Missing keywords:</strong> If the job description mentions "project management" and your resume says "managed projects," some ATS systems won't recognize the match.</li>
<li><strong>Poor formatting:</strong> Tables, columns, headers/footers, and graphics can confuse ATS parsers, causing critical information to be lost.</li>
<li><strong>Wrong file format:</strong> While PDF is generally safe, some older ATS systems prefer .docx files. Always check the application instructions.</li>
<li><strong>Lack of quantified achievements:</strong> ATS systems increasingly score resumes based on specificity — numbers, percentages, and measurable outcomes rank higher.</li>
</ul>

<h2>How to Optimize Your Resume for ATS</h2>
<p>The key to beating ATS is alignment. Your resume should mirror the language of the job description while remaining authentic to your experience. Use standard section headings (Work Experience, Education, Skills), include relevant keywords naturally throughout your content, and keep your formatting clean and simple.</p>
<p>Tools like Profile Score analyze your resume against ATS algorithms and identify exactly which keywords you're missing, what formatting issues might cause parsing errors, and how to restructure your content for maximum visibility.</p>

<h2>The Human Factor</h2>
<p>Remember: passing the ATS is only step one. Once your resume reaches a recruiter, it needs to tell a compelling story. The best approach is to optimize for both — machine-readable formatting with human-engaging content.</p>`,

    contentEs: `<h2>¿Qué es un ATS?</h2>
<p>Un Sistema de Seguimiento de Candidatos (ATS) es un software utilizado por empleadores para recopilar, clasificar, escanear y rankear solicitudes de empleo. Más del 98% de las empresas Fortune 500 usan alguna forma de ATS, y se estima que el 75% de los CVs son rechazados por estos sistemas antes de llegar a un reclutador humano.</p>

<h2>Cómo Funciona el Filtrado ATS</h2>
<p>Cuando envías tu CV en línea, no llega directamente al escritorio de un reclutador. En su lugar, el ATS analiza tu documento en datos estructurados — extrayendo tu nombre, información de contacto, historial laboral, educación y habilidades. Luego compara estos datos con los requisitos del puesto.</p>
<p>El sistema busca coincidencias de palabras clave, duración de experiencia relevante, requisitos de educación y otros criterios que el empleador ha configurado. Los CVs que no cumplen el umbral mínimo son filtrados automáticamente.</p>

<h3>Razones Comunes de Rechazo</h3>
<ul>
<li><strong>Palabras clave faltantes:</strong> Si la descripción del puesto menciona "gestión de proyectos" y tu CV dice "gestioné proyectos", algunos sistemas ATS no reconocerán la coincidencia.</li>
<li><strong>Formato inadecuado:</strong> Tablas, columnas, encabezados/pies de página y gráficos pueden confundir a los parsers ATS, causando que información crítica se pierda.</li>
<li><strong>Formato de archivo incorrecto:</strong> Aunque PDF es generalmente seguro, algunos sistemas ATS más antiguos prefieren archivos .docx.</li>
<li><strong>Falta de logros cuantificados:</strong> Los sistemas ATS cada vez más puntúan los CVs basándose en especificidad — números, porcentajes y resultados medibles rankean mejor.</li>
</ul>

<h2>Cómo Optimizar Tu CV para ATS</h2>
<p>La clave para vencer al ATS es la alineación. Tu CV debe reflejar el lenguaje de la descripción del puesto mientras se mantiene auténtico a tu experiencia. Usa encabezados de sección estándar (Experiencia Laboral, Educación, Habilidades), incluye palabras clave relevantes naturalmente y mantén tu formato limpio y simple.</p>
<p>Herramientas como Profile Score analizan tu CV contra algoritmos ATS e identifican exactamente qué palabras clave te faltan, qué problemas de formato podrían causar errores de parseo y cómo reestructurar tu contenido para máxima visibilidad.</p>

<h2>El Factor Humano</h2>
<p>Recuerda: pasar el ATS es solo el primer paso. Una vez que tu CV llega a un reclutador, necesita contar una historia convincente. El mejor enfoque es optimizar para ambos — formato legible por máquinas con contenido atractivo para humanos.</p>`,

    author: "Profile Score Team",
    publishedAt: "2025-02-15",
    updatedAt: "2026-02-28",
    tags: ["ats", "resume", "job-search"],
    readingTimeMin: 5,
  },
  {
    slug: "linkedin-profile-optimization-guide",
    title: "LinkedIn Profile Optimization: A Complete Guide",
    titleEs: "Optimización de Perfil LinkedIn: Guía Completa",
    description:
      "A comprehensive guide to optimizing every section of your LinkedIn profile for recruiter visibility, search ranking, and professional impact.",
    descriptionEs:
      "Una guía completa para optimizar cada sección de tu perfil LinkedIn para visibilidad ante reclutadores, ranking en búsquedas e impacto profesional.",
    content: `<h2>Why LinkedIn Optimization Matters</h2>
<p>LinkedIn is the world's largest professional network with over 900 million members. Recruiters spend an average of 7.4 seconds scanning a profile before deciding whether to reach out. In that brief window, your profile needs to communicate value, relevance, and professionalism.</p>
<p>An optimized LinkedIn profile doesn't just look better — it ranks higher in LinkedIn's search algorithm, making you visible to recruiters who are actively searching for candidates like you.</p>

<h2>The Headline: Your 120-Character Billboard</h2>
<p>Your headline is the most important piece of real estate on your profile. It appears in search results, connection requests, and every comment you make. Yet most people still use their default job title.</p>
<p>A strong headline follows this formula: <strong>[Role] | [Key Skill/Value] | [Result or Differentiator]</strong>. For example: "Senior Product Manager | Building AI-Powered B2B SaaS | Drove 40% ARR Growth at Series B Startup."</p>

<h2>The About Section: Tell Your Story</h2>
<p>Your About section is where personality meets professionalism. Start with a hook — a bold statement, a question, or a surprising statistic. Then connect your experience to the value you deliver. End with a clear call to action (open to opportunities, happy to connect, etc.).</p>
<p>Keep it under 2,000 characters, use short paragraphs, and include relevant keywords naturally. This section is fully indexed by LinkedIn's search algorithm.</p>

<h2>Experience: Show Impact, Not Just Duties</h2>
<p>The biggest mistake professionals make is listing responsibilities instead of achievements. Recruiters don't want to know what you were supposed to do — they want to know what you actually accomplished.</p>
<p>Use the <strong>CAR format</strong>: Challenge, Action, Result. Every bullet point should quantify impact where possible: revenue generated, users acquired, efficiency improved, costs reduced.</p>

<h2>Skills & Endorsements</h2>
<p>LinkedIn allows up to 50 skills. Use all of them strategically. Your top 3 pinned skills should match the keywords recruiters search for in your target role. Skills are a primary factor in LinkedIn's search ranking algorithm.</p>

<h2>Putting It All Together</h2>
<p>Profile optimization isn't a one-time task — it should evolve with your career. Use Profile Score to get an instant analysis of where your profile stands and specific recommendations for each section. Regular updates signal to LinkedIn's algorithm that your profile is active, which boosts your search visibility.</p>`,

    contentEs: `<h2>Por Qué Importa la Optimización de LinkedIn</h2>
<p>LinkedIn es la red profesional más grande del mundo con más de 900 millones de miembros. Los reclutadores pasan un promedio de 7.4 segundos escaneando un perfil antes de decidir si contactar. En esa breve ventana, tu perfil necesita comunicar valor, relevancia y profesionalismo.</p>
<p>Un perfil LinkedIn optimizado no solo se ve mejor — rankea más alto en el algoritmo de búsqueda de LinkedIn, haciéndote visible para reclutadores que buscan activamente candidatos como tú.</p>

<h2>El Titular: Tu Billboard de 120 Caracteres</h2>
<p>Tu titular es la pieza más importante de tu perfil. Aparece en resultados de búsqueda, solicitudes de conexión y cada comentario que haces. Sin embargo, la mayoría usa su título de trabajo por defecto.</p>
<p>Un titular fuerte sigue esta fórmula: <strong>[Rol] | [Habilidad Clave/Valor] | [Resultado o Diferenciador]</strong>. Por ejemplo: "Product Manager Senior | Construyendo SaaS B2B con IA | 40% de Crecimiento ARR en Startup Serie B."</p>

<h2>La Sección Acerca De: Cuenta Tu Historia</h2>
<p>Tu sección Acerca De es donde la personalidad se encuentra con el profesionalismo. Comienza con un gancho — una declaración audaz, una pregunta o una estadística sorprendente. Luego conecta tu experiencia con el valor que entregas. Termina con un llamado a la acción claro.</p>
<p>Mantenlo bajo 2,000 caracteres, usa párrafos cortos e incluye palabras clave relevantes naturalmente. Esta sección está completamente indexada por el algoritmo de búsqueda de LinkedIn.</p>

<h2>Experiencia: Muestra Impacto, No Solo Deberes</h2>
<p>El error más grande que cometen los profesionales es listar responsabilidades en lugar de logros. Los reclutadores no quieren saber qué se suponía que debías hacer — quieren saber qué lograste realmente.</p>
<p>Usa el <strong>formato CAR</strong>: Desafío, Acción, Resultado. Cada punto debe cuantificar el impacto donde sea posible: ingresos generados, usuarios adquiridos, eficiencia mejorada, costos reducidos.</p>

<h2>Habilidades y Avales</h2>
<p>LinkedIn permite hasta 50 habilidades. Úsalas todas estratégicamente. Tus 3 habilidades principales fijadas deben coincidir con las palabras clave que buscan los reclutadores. Las habilidades son un factor principal en el algoritmo de ranking de LinkedIn.</p>

<h2>Poniendo Todo Junto</h2>
<p>La optimización de perfil no es una tarea única — debe evolucionar con tu carrera. Usa Profile Score para obtener un análisis instantáneo de dónde se encuentra tu perfil y recomendaciones específicas para cada sección.</p>`,

    author: "Profile Score Team",
    publishedAt: "2025-03-01",
    updatedAt: "2026-02-28",
    tags: ["linkedin", "optimization", "recruiter"],
    readingTimeMin: 6,
  },
  {
    slug: "cv-vs-resume-which-one",
    title: "CV vs Resume: Which One Do You Need?",
    titleEs: "CV vs Currículum: ¿Cuál Necesitas?",
    description:
      "Understand the key differences between a CV and a resume, when to use each one, and how to optimize both for maximum impact in your job search.",
    descriptionEs:
      "Entiende las diferencias clave entre un CV y un currículum, cuándo usar cada uno y cómo optimizar ambos para máximo impacto en tu búsqueda de empleo.",
    content: `<h2>The Basics: CV vs Resume</h2>
<p>The terms "CV" and "resume" are often used interchangeably, but they serve different purposes depending on your location and industry. Understanding the distinction can mean the difference between sending the right document and immediately getting filtered out.</p>

<h2>Resume: Concise and Targeted</h2>
<p>A resume is a brief, targeted document — typically 1-2 pages — that highlights your most relevant skills and experience for a specific job. Resumes are the standard in the United States and Canada for most industries.</p>
<p>Key characteristics of a resume:</p>
<ul>
<li>1-2 pages maximum</li>
<li>Tailored to each specific job application</li>
<li>Focuses on relevant experience and skills</li>
<li>Uses concise bullet points with quantified achievements</li>
<li>Optimized for ATS (Applicant Tracking Systems)</li>
</ul>

<h2>CV (Curriculum Vitae): Comprehensive and Academic</h2>
<p>A CV is a comprehensive document that covers your entire academic and professional history. In Europe, Latin America, and much of the world, "CV" is the standard term for what Americans would call a resume. In academic and research contexts globally, a CV is a detailed document that can run many pages.</p>
<p>Key characteristics of a CV:</p>
<ul>
<li>No strict page limit (academic CVs can be 10+ pages)</li>
<li>Includes publications, research, conferences, grants</li>
<li>Generally more comprehensive than a resume</li>
<li>Standard format in Europe, Latin America, Asia, and Africa</li>
</ul>

<h2>Regional Differences</h2>
<p>In the UK, Europe, and Latin America, "CV" typically refers to a 1-2 page document similar to an American resume. In the US, "CV" specifically refers to the longer academic format. Context matters — always check what's expected in your target market.</p>

<h2>How to Optimize Both</h2>
<p>Whether you're writing a resume or a CV, the principles of optimization remain the same: use relevant keywords, quantify your achievements, maintain clean formatting, and tailor your content to your audience.</p>
<p>Profile Score supports both formats. Upload your CV or resume, and our AI will analyze it against industry standards and ATS requirements, providing specific recommendations to improve your chances of landing interviews.</p>`,

    contentEs: `<h2>Lo Básico: CV vs Currículum</h2>
<p>Los términos "CV" y "currículum" se usan frecuentemente de manera intercambiable, pero sirven propósitos diferentes según tu ubicación e industria. Entender la distinción puede significar la diferencia entre enviar el documento correcto y ser filtrado inmediatamente.</p>

<h2>Currículum: Conciso y Dirigido</h2>
<p>Un currículum es un documento breve y dirigido — típicamente 1-2 páginas — que destaca tus habilidades y experiencia más relevantes para un trabajo específico. Los currículums son el estándar en Estados Unidos y Canadá para la mayoría de las industrias.</p>
<p>Características clave:</p>
<ul>
<li>1-2 páginas máximo</li>
<li>Adaptado a cada solicitud de empleo específica</li>
<li>Se enfoca en experiencia y habilidades relevantes</li>
<li>Usa puntos concisos con logros cuantificados</li>
<li>Optimizado para ATS (Sistemas de Seguimiento de Candidatos)</li>
</ul>

<h2>CV (Curriculum Vitae): Completo y Académico</h2>
<p>Un CV es un documento completo que cubre toda tu historia académica y profesional. En Europa, América Latina y gran parte del mundo, "CV" es el término estándar. En contextos académicos, un CV es un documento detallado que puede extenderse muchas páginas.</p>
<p>Características clave:</p>
<ul>
<li>Sin límite estricto de páginas (CVs académicos pueden tener 10+ páginas)</li>
<li>Incluye publicaciones, investigación, conferencias, becas</li>
<li>Generalmente más completo que un currículum</li>
<li>Formato estándar en Europa, América Latina, Asia y África</li>
</ul>

<h2>Diferencias Regionales</h2>
<p>En el Reino Unido, Europa y América Latina, "CV" típicamente se refiere a un documento de 1-2 páginas similar al currículum estadounidense. En EE.UU., "CV" se refiere específicamente al formato académico más largo. El contexto importa — siempre verifica qué se espera en tu mercado objetivo.</p>

<h2>Cómo Optimizar Ambos</h2>
<p>Ya sea que estés escribiendo un currículum o un CV, los principios de optimización son los mismos: usa palabras clave relevantes, cuantifica tus logros, mantén un formato limpio y adapta tu contenido a tu audiencia.</p>
<p>Profile Score soporta ambos formatos. Sube tu CV o currículum, y nuestra IA lo analizará contra estándares de la industria y requisitos ATS, proporcionando recomendaciones específicas para mejorar tus posibilidades.</p>`,

    author: "Profile Score Team",
    publishedAt: "2025-03-10",
    updatedAt: "2026-02-28",
    tags: ["cv", "resume", "career"],
    readingTimeMin: 4,
  },
];

export function getAllPosts(): BlogPost[] {
  return posts.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getPostsByTag(tag: string): BlogPost[] {
  return posts.filter((p) => p.tags.includes(tag)).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}
