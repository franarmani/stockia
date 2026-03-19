-- Create private storage bucket for AFIP certificates
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('afip-certs', 'afip-certs', false, 5242880)
ON CONFLICT (id) DO NOTHING;
