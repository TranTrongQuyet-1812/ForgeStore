import { describe, expect, it } from 'vitest';
import { lyDoBoTheoSieuDuLieu, mucUuTien } from './liet-ke.core';

const meta = (full_name: string, description: string | null, topics: string[] = []) => ({
  full_name,
  description,
  topics,
});

describe('lyDoBoTheoSieuDuLieu (bỏ thư viện, ngôn ngữ, framework theo siêu dữ liệu)', () => {
  it('bỏ theo chủ đề: thư viện, framework, awesome, tiện ích trình duyệt', () => {
    expect(lyDoBoTheoSieuDuLieu(meta('a/b', 'x', ['react', 'library']))).toBe('chu-de:library');
    expect(lyDoBoTheoSieuDuLieu(meta('a/b', 'x', ['Framework']))).toBe('chu-de:framework');
    expect(lyDoBoTheoSieuDuLieu(meta('a/b', 'x', ['awesome-list']))).toBe('chu-de:awesome-list');
    expect(lyDoBoTheoSieuDuLieu(meta('a/b', 'x', ['chrome-extension']))).toBe(
      'chu-de:chrome-extension',
    );
  });

  it('bỏ theo mô tả tự nhận là thư viện, framework, SDK, ngôn ngữ lập trình', () => {
    for (const mota of [
      'A fast and safe formatting library for C++',
      'A lightweight framework for building AI agents',
      'The official Python SDK for the Stripe API',
      'Python GraphQL library based on dataclasses',
      'A systems programming language focused on safety',
      'Free cheat sheet and tutorial for beginners',
      'Material Design component library for React',
    ]) {
      expect(lyDoBoTheoSieuDuLieu(meta('a/b', mota)), mota).not.toBeNull();
    }
  });

  it('giữ ứng dụng, kể cả khi mô tả nhắc framework hay thư viện mà nó DÙNG', () => {
    for (const mota of [
      'A modern desktop app built with the Tauri framework',
      'Desktop client for ChatGPT with a native wrapper UI',
      'Offline speech-to-text tool using the whisper.cpp library',
      'A fast and simple video downloader built with Go',
      null,
    ]) {
      expect(lyDoBoTheoSieuDuLieu(meta('a/b', mota)), String(mota)).toBeNull();
    }
    expect(
      lyDoBoTheoSieuDuLieu(meta('a/b', 'Translate app', ['language', 'translation', 'wrapper'])),
    ).toBeNull();
  });
});

describe('mucUuTien (1 = AI, 2 = cài trực tiếp/portable, 3 = còn lại)', () => {
  it('AI xếp hạng 1 theo chủ đề hoặc mô tả', () => {
    expect(mucUuTien(meta('a/b', 'x', ['llm']))).toBe(1);
    expect(mucUuTien(meta('a/b', 'A local ChatGPT-style client for Ollama'))).toBe(1);
  });

  it('phần mềm desktop/portable xếp hạng 2', () => {
    expect(mucUuTien(meta('a/b', 'x', ['windows']))).toBe(2);
    expect(mucUuTien(meta('a/b', 'A portable screen recorder with GUI'))).toBe(2);
  });

  it('AI thắng khi vừa AI vừa desktop; còn lại hạng 3', () => {
    expect(mucUuTien(meta('a/b', 'Desktop app for AI chat', ['desktop']))).toBe(1);
    expect(mucUuTien(meta('a/b', 'A fast video downloader'))).toBe(3);
  });
});
