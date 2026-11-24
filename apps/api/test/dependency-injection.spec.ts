import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

// Nest resolves constructor dependencies from TypeScript's decorator metadata. If the test
// compiler stops emitting it, injected services silently become undefined; this test fails first.
@Injectable()
class Dependency {
  readonly value = 'injected';
}

@Injectable()
class Consumer {
  constructor(readonly dependency: Dependency) {}
}

@Module({ providers: [Dependency, Consumer] })
class TestModule {}

describe('dependency injection', () => {
  it('injects constructor dependencies by type', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
    expect(moduleRef.get(Consumer).dependency.value).toBe('injected');
  });
});
