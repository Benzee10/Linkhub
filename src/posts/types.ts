export interface Group {
  name: string;
  description: string;
  members: string;
  link: string;
}

export interface PostDetail {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  intro: string;
  content: string;
  keywords?: string[];
  trending?: boolean;
  groups: Group[];
}

export interface BlogPostSection {
  heading: string;
  body: string;
  image?: string;
  imageCaption?: string;
  whatsappCta?: {
    title: string;
    description: string;
    buttonText?: string;
    targetCategory?: string;
    groupLink?: string;
  };
}

export interface BlogPost {
  id: string;
  title: string;
  description: string;
  excerpt: string;
  coverImage: string;
  socialPreviewImage?: string;
  category: string;
  author: string;
  authorRole?: string;
  readTime: string;
  date: string;
  tags?: string[];
  content: BlogPostSection[];
}
