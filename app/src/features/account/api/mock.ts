import { rest } from 'msw';

const handlers = [
  rest.delete('/account/logout', (req, res, ctx) => {
    if (!req.cookies['unchecked_user']) {
      return res(ctx.status(401));
    }

    return res(
      ctx.status(200),
      ctx.cookie('unchecked_user', '', { maxAge: -1 }),
    );
  }),
];

export default handlers;
