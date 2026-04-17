-- Функция для seed социального демо
CREATE OR REPLACE FUNCTION public.seed_demo_community(_caller UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _names TEXT[] := ARRAY[
    'Анна','Лев','Маша','Дима','Ника','Артём','Соня','Глеб','Юля','Кирилл',
    'Вера','Олег','Лиза','Тимур','Ева'
  ];
  _usernames TEXT[] := ARRAY[
    'anna_quiet','lev_thinks','masha_glow','dima_walks','nika_storm','artem_late',
    'sonya_calm','gleb_moves','yulia_pause','kirill_runs','vera_bright','oleg_fade',
    'liza_north','timur_owl','eva_clear'
  ];
  _bios TEXT[] := ARRAY[
    'Учусь слушать тишину внутри.',
    'Книги, чай, бег. В этом порядке.',
    'Психолог в декрете. Пробую жить медленнее.',
    'Дизайн днём, ноты вечером. Ищу баланс.',
    'Тренер и мама. Без фильтров.',
    'Программист, который начал ходить в терапию.',
    'Фотограф эмоций. Много молчу.',
    'Бегу ультра. И от себя тоже иногда.',
    'Мать-одиночка. Учусь не выгорать.',
    'Подкаст про взрослую жизнь. Иногда грустно.',
    'Травма-информированная йога.',
    'Преподаватель. Только пришёл в терапию.',
    'Нейробиолог-любитель. Пишу в стол.',
    'Совы — мои люди. Засыпаю в 4.',
    'Каждый день — маленький эксперимент.'
  ];
  _categories TEXT[] := ARRAY['дилемма','наблюдение','прорыв','вопрос','практика'];
  _post_templates TEXT[] := ARRAY[
    'Сегодня впервые за месяц встал в 7 утра без будильника. Не знаю, что изменилось.',
    'Поймал себя на том, что три часа листаю ленту вместо того, чтобы писать дипломную. Что я ищу там? Подтверждения, что я не один такой?',
    'Терапевт сказал: "Не путай тревогу с интуицией". Думаю об этом весь день.',
    'Сделал короткую прогулку в обед. 20 минут. Вторая половина дня прошла иначе. Совпадение?',
    'Если бы я сказал маме правду один раз — что бы я сказал?',
    'Заметил: когда не сплю достаточно, любые новости становятся катастрофой. Сон — это политика.',
    'Прорыв: впервые отказал коллеге без вины. Сердце колотилось час, но я не отменил решение.',
    'Странно, что мы называем "продуктивностью" способность игнорировать тело.',
    'Практика 4-7-8 перед сном. Третья ночь подряд. Засыпаю быстрее, но просыпаюсь ночью.',
    'Кто-то ещё чувствует, что соцсети это новая форма одиночества?',
    'Сходил впервые на групповую терапию. Думал — фигня. Вышел плачущим. Не от боли — от того, что услышан.',
    'Дилемма: сказать ему правду и потерять, или молчать и потерять себя?',
    'Заметка для будущего меня: ты не обязан быть полезным каждую минуту, чтобы заслужить отдых.',
    'Месяц без алкоголя. Главный инсайт — оказывается, я выпивал, чтобы не чувствовать. Теперь чувствую много. И это страшно.',
    'Перечитал старые записи годовалой давности. Тот я думал, что не справится. А вот.',
    'Почему мы так легко принимаем поддержку от незнакомцев в интернете и так трудно — от близких?',
    'Когда последний раз ты делал что-то впервые? Я — сегодня. Записался на гончарный мастер-класс.',
    'Гипотеза: половина моих "хочу" — это "должен", переодетые в маркетинг.',
    'Триггер дня: запах бабушкиных духов в метро. Села плакать прямо на платформе.',
    'Психолог попросил написать письмо себе 12-летнему. Не могу. Слишком больно. Это значит — точно надо.',
    'Заметил, что в выходные настроение стабильно ниже, чем в будни. Думал — наоборот.',
    'Первый день без новостей. Тишина в голове, к которой непривычно.',
    'Не знаю, как это назвать. Не грусть, не усталость. Просто… тонко.',
    'Кофе после 14:00 = бессонница в 2 ночи. Стабильно. Почему я снова не учусь?',
    'Поговорил с отцом впервые за 3 года. Ничего не решил. Но и не разрушил. Уже победа.',
    'Ходить пешком вместо метро — сэкономил 20 минут на качество жизни.',
    'Когда я говорю "я устал", я имею в виду "я перестал чувствовать вкус жизни". Это разные вещи.',
    'Мой внутренний критик — это голос моей учительницы математики. Узнал это сегодня.',
    'Эксперимент: неделя без жалоб вслух. Третий день. Тяжелее, чем месяц без сахара.',
    'Если ваша работа высасывает вас по пятницам — это не вы слабый. Это среда токсичная.'
  ];
  _comment_templates TEXT[] := ARRAY[
    'Это очень знакомо. Спасибо, что написал.',
    'А что если попробовать наоборот?',
    'Я через это прошёл год назад. Стало легче.',
    'Сильно. Сохранил себе.',
    'Думаю об этом всю неделю.',
    'Не один. Я тоже.',
    'Что помогло именно тебе?',
    'Это не слабость, это сигнал.',
    'Поддерживаю. Дыши.',
    'Прорыв! Поздравляю.',
    'Спасибо. Прямо в точку.',
    'А если попробовать письменную практику?',
    'Тонко подмечено.',
    'Согласен на 100%.',
    'Это требует мужества — признать.'
  ];
  _user_ids UUID[];
  _post_ids UUID[];
  _new_user UUID;
  _new_post UUID;
  i INT; j INT; k INT;
  _post_count INT := 150;
  _post_text TEXT;
  _post_cat TEXT;
  _author UUID;
  _ts TIMESTAMPTZ;
  _reactions TEXT[] := ARRAY['heart','fire','thought','hug','sad'];
  _commenters_n INT;
  _reactors_n INT;
BEGIN
  -- Защита: только сам пользователь может seed для себя
  IF auth.uid() IS NULL OR auth.uid() <> _caller THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- 1) Создать 15 демо-профилей (если ещё нет)
  FOR i IN 1..array_length(_names, 1) LOOP
    _new_user := gen_random_uuid();
    INSERT INTO public.profiles (
      user_id, display_name, username, bio, is_demo, ai_tone, language,
      avatar_url, created_at
    ) VALUES (
      _new_user,
      _names[i],
      _usernames[i],
      _bios[i],
      true, 'soft', 'ru',
      NULL,
      now() - (random() * interval '90 days')
    )
    ON CONFLICT DO NOTHING;
    -- Если по unique-индексу username уже занят, найдём существующий демо-профиль
    IF NOT FOUND THEN
      SELECT user_id INTO _new_user FROM public.profiles WHERE lower(username) = lower(_usernames[i]) LIMIT 1;
    END IF;
    _user_ids := array_append(_user_ids, _new_user);
  END LOOP;

  -- 2) Сгенерировать ~150 постов от демо-юзеров за последние 60 дней
  _post_ids := ARRAY[]::UUID[];
  FOR i IN 1.._post_count LOOP
    _post_text := _post_templates[1 + floor(random() * array_length(_post_templates, 1))::INT];
    _post_cat := _categories[1 + floor(random() * array_length(_categories, 1))::INT];
    _author := _user_ids[1 + floor(random() * array_length(_user_ids, 1))::INT];
    _ts := now() - (random() * interval '60 days');
    _new_post := gen_random_uuid();
    INSERT INTO public.posts (id, user_id, category, content, created_at, updated_at, is_ai)
    VALUES (_new_post, _author, _post_cat, _post_text, _ts, _ts, false);
    _post_ids := array_append(_post_ids, _new_post);

    -- Реакции от 0 до 12 случайных демо-юзеров
    _reactors_n := floor(random() * 13)::INT;
    FOR j IN 1.._reactors_n LOOP
      INSERT INTO public.post_reactions (post_id, user_id, reaction, created_at)
      VALUES (
        _new_post,
        _user_ids[1 + floor(random() * array_length(_user_ids, 1))::INT],
        _reactions[1 + floor(random() * array_length(_reactions, 1))::INT],
        _ts + (random() * interval '5 days')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Старые лайки тоже добавляем (для совместимости со счётчиком)
    FOR j IN 1..floor(random() * 8)::INT LOOP
      INSERT INTO public.post_likes (post_id, user_id, created_at)
      VALUES (
        _new_post,
        _user_ids[1 + floor(random() * array_length(_user_ids, 1))::INT],
        _ts + (random() * interval '3 days')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;

    -- Комменты от 0 до 5
    _commenters_n := floor(random() * 6)::INT;
    FOR k IN 1.._commenters_n LOOP
      INSERT INTO public.post_comments (post_id, user_id, content, created_at)
      VALUES (
        _new_post,
        _user_ids[1 + floor(random() * array_length(_user_ids, 1))::INT],
        _comment_templates[1 + floor(random() * array_length(_comment_templates, 1))::INT],
        _ts + (random() * interval '7 days')
      );
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'users', array_length(_user_ids, 1),
    'posts', _post_count
  );
END $$;

-- Очистка демо-данных
CREATE OR REPLACE FUNCTION public.clear_demo_community(_caller UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _demo_ids UUID[];
  _n INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _caller THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT array_agg(user_id) INTO _demo_ids FROM public.profiles WHERE is_demo = true;
  IF _demo_ids IS NULL THEN RETURN jsonb_build_object('removed', 0); END IF;
  _n := array_length(_demo_ids, 1);
  -- Каскад через FK для post_reactions/post_comments/post_likes частично есть (CASCADE на post_id),
  -- но у likes/comments user_id без FK — чистим явно.
  DELETE FROM public.post_reactions WHERE user_id = ANY(_demo_ids);
  DELETE FROM public.post_likes WHERE user_id = ANY(_demo_ids);
  DELETE FROM public.post_comments WHERE user_id = ANY(_demo_ids);
  DELETE FROM public.posts WHERE user_id = ANY(_demo_ids);
  DELETE FROM public.profiles WHERE user_id = ANY(_demo_ids);
  RETURN jsonb_build_object('removed', _n);
END $$;