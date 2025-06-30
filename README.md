# Overleaf Clone

A collaborative LaTeX editor built with Next.js, TailwindCSS, shadcn/ui, and Supabase. Features include real-time collaboration, instant PDF preview, project templates, and version history.

## Features

- 🤝 Real-time collaborative editing
- 📄 Instant PDF preview
- 📝 Project templates
- 📚 Version history
- 🔒 Authentication with email/password
- 🔗 Shareable document links

## Prerequisites

1. [Node.js](https://nodejs.org/) (v18 or newer)
2. [Supabase Account](https://supabase.com/) (free tier works fine)

## Setup Instructions (PowerShell)

### 1. Clone and Install Dependencies

```powershell
# Clone the repository
git clone <your-repo-url>
cd overleaf-clone

# Install dependencies
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Create the following tables in your Supabase database:

```sql
-- Documents table
create table documents (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null default '',
  owner_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Document versions table
create table document_versions (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references documents(id) on delete cascade,
  content text not null,
  created_by uuid references auth.users(id),
  message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Templates table
create table templates (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  description text,
  content text not null,
  category text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

3. Set up Row Level Security (RLS) policies:

```sql
-- Documents RLS
alter table documents enable row level security;

create policy "Users can view their own documents"
  on documents for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own documents"
  on documents for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own documents"
  on documents for update
  using (auth.uid() = owner_id);

-- Document versions RLS
alter table document_versions enable row level security;

create policy "Users can view document versions they have access to"
  on document_versions for select
  using (
    exists (
      select 1 from documents
      where documents.id = document_versions.document_id
      and documents.owner_id = auth.uid()
    )
  );

create policy "Users can create versions for their documents"
  on document_versions for insert
  with check (
    exists (
      select 1 from documents
      where documents.id = document_versions.document_id
      and documents.owner_id = auth.uid()
    )
  );
```

### 3. Configure Environment Variables

1. Copy the example environment file:
```powershell
copy .env.example .env.local
```

2. Update `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Run the Development Server

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Development

- `src/app/` - Next.js pages and API routes
- `src/components/` - React components
- `src/lib/` - Utility functions and services
- `src/types/` - TypeScript type definitions

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
