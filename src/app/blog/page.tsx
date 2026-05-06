import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog/posts";
import BlogIndexClient from "./BlogIndexClient";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Expert tips on LinkedIn optimization, ATS-friendly resumes, and career growth. Learn how to improve your professional profile and land more interviews.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog | Profile Score",
    description:
      "Expert tips on LinkedIn optimization, ATS-friendly resumes, and career growth.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | Profile Score",
    description:
      "Expert tips on LinkedIn optimization, ATS-friendly resumes, and career growth.",
  },
};

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const posts = await getAllPosts();
  return <BlogIndexClient posts={posts} />;
}
